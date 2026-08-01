const { emitAuditEvent } = require("/opt/nodejs/utils/auditClient");

const SAFE_INVOICE_FIELDS = [
  "invoiceDate",
  "dueDate",
  "subtotal",
  "gstAmount",
  "discountAmount",
  "otherCharges",
  "totalAmount",
  "amountPaid",
  "amountDue",
  "currencyCode",
  "status",
  "paymentStatus",
  "paymentTermsDays",
  "poNumber",
];

const SAFE_PAYMENT_FIELDS = ["amount", "paymentMethod", "paymentDate", "status"];

async function auditInvoiceEvent(
  req,
  {
    eventType,
    action,
    severity,
    category = "INVOICE",
    invoice,
    payment,
    changes,
    metadata = {},
    tenantId,
    outcomeStatus = "SUCCESS",
    reason = "",
    errorCode = "",
  },
) {
  try {
    const resolvedTenantId =
      tenantId ||
      readField(invoice, "tenantId") ||
      (await findOrderTenant(req, readField(invoice, "orderId"))) ||
      getHeader(req, "x-k2b-audit-tenant-id") ||
      "platform";

    return await emitAuditEvent(
      {
        service: "order-management",
        tenantId: String(resolvedTenantId),
        eventType,
        action,
        category,
        severity,
        actor: buildActor(req),
        resource: {
          type: "INVOICE",
          id: String(readField(invoice, "id") || req.params?.id || ""),
          name: readField(invoice, "invoiceNumber") || "Invoice",
          ownerId: String(readField(invoice, "userId") || ""),
        },
        outcome: {
          status: outcomeStatus,
          ...(reason ? { reason: sanitizeReason(reason) } : {}),
          ...(errorCode ? { errorCode } : {}),
        },
        changes,
        metadata: {
          invoiceId: String(readField(invoice, "id") || req.params?.id || ""),
          invoiceNumber: readField(invoice, "invoiceNumber") || "",
          orderId: String(readField(invoice, "orderId") || req.params?.orderId || ""),
          customerId: String(readField(invoice, "userId") || ""),
          paymentId: String(readField(payment, "id") || ""),
          ...metadata,
        },
      },
      { req },
    );
  } catch (error) {
    console.error("Unexpected invoice audit failure", {
      eventType,
      invoiceId: readField(invoice, "id") || req.params?.id,
      errorMessage: error.message,
    });
    return { ok: false, errorType: "AUDIT_HELPER_FAILED" };
  }
}

function buildInvoiceChanges(beforeInvoice, afterInvoice) {
  return buildChanges(beforeInvoice, afterInvoice, SAFE_INVOICE_FIELDS);
}

function buildPaymentChanges(beforePayment, afterPayment) {
  return buildChanges(beforePayment, afterPayment, SAFE_PAYMENT_FIELDS);
}

function pickSafeInvoiceFields(invoice) {
  return pickFields(invoice, SAFE_INVOICE_FIELDS);
}

function pickSafePaymentFields(payment) {
  return pickFields(payment, SAFE_PAYMENT_FIELDS);
}

function buildChanges(beforeValue, afterValue, fields) {
  const before = {};
  const after = {};

  for (const field of fields) {
    const previous = normalizeValue(readField(beforeValue, field));
    const current = normalizeValue(readField(afterValue, field));
    if (!valuesEqual(previous, current)) {
      if (previous !== undefined) before[field] = previous;
      if (current !== undefined) after[field] = current;
    }
  }

  return { before, after };
}

function pickFields(value, fields) {
  return Object.fromEntries(
    fields
      .map((field) => [field, normalizeValue(readField(value, field))])
      .filter(([, fieldValue]) => fieldValue !== undefined),
  );
}

function buildActor(req) {
  const user = req.user || {};
  const isAdmin = Boolean(user.isAdmin || user.adminId || user.role);

  if (!user.sub && !user.id && !user.adminId) {
    return {
      id: "invoice-handler",
      type: "SYSTEM",
      email: "",
      name: "Invoice automation",
      roles: [],
    };
  }

  return {
    id: String(user.adminId || user.id || user.sub),
    type: isAdmin ? "ADMIN" : "CUSTOMER",
    email: user.email || "",
    name: user.name || user.email || "",
    roles: user.role ? [user.role] : user.roles || [],
  };
}

async function findOrderTenant(req, orderId) {
  if (!orderId || !req?.pool?.query) return "";
  const configuredSchema = process.env.ENVIRONMENT || "dev";
  const schema = /^[A-Za-z_][A-Za-z0-9_]*$/.test(configuredSchema)
    ? configuredSchema
    : "dev";
  try {
    const result = await req.pool.query(
      `SELECT tenant_id FROM ${schema}.orders WHERE id = $1 LIMIT 1`,
      [orderId],
    );
    return result.rows[0]?.tenant_id || "";
  } catch (error) {
    console.warn("Unable to resolve invoice tenant for audit event", {
      orderId,
      errorMessage: error.message,
    });
    return "";
  }
}

function readField(value, camelField) {
  if (!value) return undefined;
  const snakeField = camelField.replace(/([A-Z])/g, "_$1").toLowerCase();
  return value[camelField] ?? value[snakeField];
}

function normalizeValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (value === null) return undefined;
  return value;
}

function valuesEqual(left, right) {
  if (typeof left === "object" || typeof right === "object") {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  return left === right;
}

function sanitizeReason(reason) {
  const value = String(reason || "");
  if (/password|token|secret|authorization|credential|signed|presigned|https?:\/\//i.test(value)) {
    return "Invoice operation failed";
  }
  return value.slice(0, 200);
}

function getHeader(req, name) {
  const headers = req?.headers || {};
  const matchedKey = Object.keys(headers).find(
    (key) => key.toLowerCase() === name.toLowerCase(),
  );
  return matchedKey ? headers[matchedKey] : "";
}

module.exports = {
  auditInvoiceEvent,
  buildInvoiceChanges,
  buildPaymentChanges,
  pickSafeInvoiceFields,
  pickSafePaymentFields,
  sanitizeReason,
};
