const express = require("express");
const cors = require("cors");
const serverless = require("serverless-http");
const { getDbPool } = require("/opt/nodejs/db");
const orderRoutes = require("./routes/orders");

let pool = null; // Module-level pool, reused across Lambda invocations

const getPool = async () => {
  if (!pool) {
    pool = await getDbPool();
  }
  return pool;
};

const app = express();

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = ["http://localhost:3008", "https://dkuruf9x2pu8c.cloudfront.net"];
    if (allowedOrigins.includes(origin) || !origin) {
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

app.use("/orders", orderRoutes);

const handler = serverless(app);

exports.handler = async (event, context) => {
  console.log("[Lambda Event]", JSON.stringify(event));
  return handler(event, context);
};
