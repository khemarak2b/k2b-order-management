const express = require("express");
const cors = require("cors");
const serverless = require("serverless-http");
const { getDbPool } = require("/opt/nodejs/database/db");
const cartRoutes = require("./routes/cart");
const { extractAndInjectCognitoAuth } = require("/opt/nodejs/utils/cognitoExtractor");

let pool = null; // Module-level pool, reused across Lambda invocations

const getPool = async () => {
  if (!pool) {
    pool = await getDbPool();
  }
  return pool;
};

const app = express();

const ALLOWED_ORIGINS = new Set([
  "http://localhost:3008",
  "https://dkuruf9x2pu8c.cloudfront.net",
  "https://dev-app.k2b.com.au",
  "https://app.k2b.com.au",
  // admin app
  "http://localhost:3009",
  "https://dev-admin.k2b.com.au",
  "https://admin.k2b.com.au",
]);

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

app.use("/cart", cartRoutes);

const handler = serverless(app);

exports.handler = async (event, context) => {
  const requestId = context.awsRequestId;

  console.log(`[${requestId}] Lambda event:`, JSON.stringify(event, null, 2));

  try {
    // Extract and inject Cognito auth info
    extractAndInjectCognitoAuth(event, requestId);

    const response = await handler(event, context);
    return response;
  } catch (error) {
    console.error(`[${requestId}] Handler error:`, error);
    throw error;
  }
};
