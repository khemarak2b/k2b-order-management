const express = require("express");
const cors = require("cors");
const serverless = require("serverless-http");
const { getDbPool } = require("/opt/nodejs/database/db");
const adminOrderRoutes = require("./routes/adminOrders");
const { extractAndInjectCognitoAuth } = require("/opt/nodejs/utils/cognitoExtractor");

let pool = null; // Module-level pool, reused across Lambda invocations

const getPool = async () => {
  if (!pool) {
    pool = await getDbPool();
  }
  return pool;
};

const app = express();

const ALLOWED_ORIGINS = new Set(["http://localhost:3009", "https://dev-admin.k2b.com.au", "https://admin.k2b.com.au"]);

const corsOptions = {
  origin: (origin, callback) => {
    if (ALLOWED_ORIGINS.has(origin) || !origin) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-Amz-Date", "Authorization", "X-Api-Key", "X-Amz-Security-Token"],
};

app.use(cors(corsOptions));
app.use(express.json());

// Attach pool to request object
app.use(async (req, res, next) => {
  req.pool = await getPool();
  next();
});

// Attach Lambda event context for auth middleware
app.use((req, res, next) => {
  const cognitoAuth = req.get("x-cognito-authentication-provider");
  if (cognitoAuth) {
    req.cognitoAuthProvider = cognitoAuth;
  }
  next();
});

app.use("/admin-orders", adminOrderRoutes);

const handler = serverless(app);

exports.handler = async (event, context) => {
  const requestId = context.awsRequestId;

  console.log(`[${requestId}] Lambda event:`, JSON.stringify(event, null, 2));

  try {
    // Extract and inject Cognito auth info
    extractAndInjectCognitoAuth(event, requestId);
    injectAuditRequestContext(event, context);

    const response = await handler(event, context);
    return response;
  } catch (error) {
    console.error(`[${requestId}] Handler error:`, error);
    throw error;
  }
};

function injectAuditRequestContext(event, context) {
  const claims = event?.requestContext?.authorizer?.claims || {};
  const tenantId =
    claims.tenantId ||
    claims.tenant_id ||
    claims["custom:tenantId"] ||
    claims["custom:tenant_id"];
  const correlationId =
    getEventHeader(event, "x-correlation-id") ||
    event?.requestContext?.requestId ||
    context?.awsRequestId;
  const originRequestId = event?.requestContext?.requestId || context?.awsRequestId;

  setTrustedHeader(event, "x-k2b-audit-tenant-id", tenantId);
  setTrustedHeader(event, "x-k2b-audit-request-id", originRequestId);

  if (correlationId) {
    setEventHeader(event, "x-correlation-id", correlationId);
  }
}

function getEventHeader(event, name) {
  const headers = event?.headers || {};
  const matchedKey = Object.keys(headers).find((key) => key.toLowerCase() === name.toLowerCase());
  return matchedKey ? headers[matchedKey] : "";
}

function setTrustedHeader(event, name, value) {
  deleteEventHeader(event, name);
  if (value !== undefined && value !== null && value !== "") {
    setEventHeader(event, name, String(value));
  }
}

function setEventHeader(event, name, value) {
  event.headers = event.headers || {};
  deleteEventHeader(event, name);
  event.headers[name] = value;
}

function deleteEventHeader(event, name) {
  if (!event?.headers) return;
  for (const key of Object.keys(event.headers)) {
    if (key.toLowerCase() === name.toLowerCase()) {
      delete event.headers[key];
    }
  }
}
