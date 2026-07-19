const { getParameterStoreValueByKey } = require("./parameterStoreHelper");

const DEFAULT_TIMEOUT_MS = 1500;
const SENSITIVE_KEY_PATTERN =
  /password|token|secret|authorization|cookie|api[-_]?key|access[-_]?key|refresh|card|cvv|cvc|credential|signed[-_]?url|payment[-_]?details/i;

const getHeader = (req, name) => {
  const headers = req?.headers || {};
  const matchedKey = Object.keys(headers).find((key) => key.toLowerCase() === name.toLowerCase());
  return matchedKey ? headers[matchedKey] : "";
};

const getCorrelationId = (req) =>
  getHeader(req, "x-correlation-id") ||
  getHeader(req, "x-request-id") ||
  req?.apiGateway?.context?.awsRequestId ||
  req?.apiGateway?.event?.requestContext?.requestId ||
  req?.requestContext?.requestId ||
  "";

const redactValue = (value) => {
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? "[REDACTED]" : redactValue(entryValue),
      ]),
    );
  }
  return value;
};

const compactObject = (value) =>
  Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined));

const buildRequestContext = (req, correlationId) =>
  compactObject({
    correlationId,
    requestId: getHeader(req, "x-k2b-audit-request-id"),
    sourceIp:
      req?.apiGateway?.event?.requestContext?.identity?.sourceIp ||
      req?.ip ||
      getHeader(req, "x-forwarded-for"),
    userAgent: getHeader(req, "user-agent"),
    method: req?.method,
    path: req?.originalUrl || req?.path,
  });

const getConfiguredIngestionToken = async (options = {}) => {
  if (options.ingestionToken || process.env.AUDIT_INGESTION_TOKEN) {
    return options.ingestionToken || process.env.AUDIT_INGESTION_TOKEN;
  }
  const parameterName =
    options.ingestionTokenParameterName || process.env.AUDIT_INGESTION_TOKEN_PARAMETER_NAME;
  if (!parameterName) return "";
  const parameters = await getParameterStoreValueByKey([parameterName], true);
  return parameters.get(parameterName)?.Value || "";
};

const logAuditFailure = (message, result, eventPayload, errorMessage) => {
  const context = {
    ...result,
    service: eventPayload.service || "unknown",
    eventType: eventPayload.eventType || "UNKNOWN_EVENT",
    tenantId: eventPayload.tenantId || "unknown",
    actorId: eventPayload.actor?.id || "unknown",
    resource: eventPayload.resource,
    ...(errorMessage ? { errorMessage } : {}),
  };
  console.error(message, context);
  console.log(
    JSON.stringify({
      _aws: {
        Timestamp: Date.now(),
        CloudWatchMetrics: [
          {
            Namespace: "K2B/Audit",
            Dimensions: [["Service", "ErrorType"]],
            Metrics: [{ Name: "AuditWriteFailure", Unit: "Count" }],
          },
        ],
      },
      Service: context.service,
      ErrorType: result.errorType,
      AuditWriteFailure: 1,
      eventType: context.eventType,
      tenantId: context.tenantId,
      actorId: context.actorId,
      correlationId: result.correlationId,
    }),
  );
};

const emitAuditEvent = async (eventPayload, options = {}) => {
  const auditApiUrl = options.auditApiUrl || process.env.AUDIT_API_URL;
  const correlationId =
    eventPayload.correlationId ||
    eventPayload.request?.correlationId ||
    getCorrelationId(options.req);

  let ingestionToken;
  try {
    ingestionToken = await getConfiguredIngestionToken(options);
  } catch (error) {
    const result = { ok: false, errorType: "AUDIT_TOKEN_LOOKUP_FAILED", correlationId };
    logAuditFailure("Audit ingestion token lookup failed", result, eventPayload, error.message);
    return result;
  }

  if (!auditApiUrl || !ingestionToken) {
    const result = { ok: false, errorType: "AUDIT_NOT_CONFIGURED", correlationId };
    logAuditFailure("Audit event was not sent because audit configuration is missing", result, eventPayload);
    return result;
  }

  const timeoutMs = Number(options.timeoutMs || process.env.AUDIT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const payload = redactValue({
    ...eventPayload,
    request: {
      ...buildRequestContext(options.req, correlationId),
      ...eventPayload.request,
      correlationId,
    },
  });

  try {
    const response = await fetch(auditApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Audit-Ingestion-Token": ingestionToken,
        ...(correlationId ? { "X-Correlation-Id": correlationId } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const responseBody = await response.json().catch(() => ({}));
    if (!response.ok) {
      const result = {
        ok: false,
        errorType: "AUDIT_API_ERROR",
        statusCode: response.status,
        correlationId,
      };
      logAuditFailure("Audit event failed", result, eventPayload);
      return result;
    }
    return { ok: true, id: responseBody.id, correlationId: responseBody.correlationId || correlationId };
  } catch (error) {
    const result = {
      ok: false,
      errorType: error.name === "AbortError" ? "AUDIT_TIMEOUT" : "AUDIT_REQUEST_FAILED",
      correlationId,
    };
    logAuditFailure("Audit event request failed", result, eventPayload, error.message);
    return result;
  } finally {
    clearTimeout(timeout);
  }
};

module.exports = { emitAuditEvent, getCorrelationId, redactValue };
