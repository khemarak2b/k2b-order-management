const assert = require("node:assert/strict");
const http = require("node:http");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");

// In Lambda these resolve through the layer, so point them at its source here.
const layerRoot = path.resolve(__dirname, "../../../k2bordermanagementlayer/lib/nodejs");
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request.startsWith("/opt/nodejs/")) {
    return originalResolve.call(this, path.join(layerRoot, request.slice("/opt/nodejs/".length)), ...rest);
  }
  if (request === "express") {
    return originalResolve.call(this, path.join(layerRoot, "node_modules/express"), ...rest);
  }
  return originalResolve.call(this, request, ...rest);
};

const stub = (relativePath, exports) => {
  const resolved = require.resolve(relativePath);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
};

const CUSTOMER_SUB = "customer-sub";
const CUSTOMER_ID = 10;
const orders = {
  1: { id: 1, user_id: String(CUSTOMER_ID), status: "pending" },
  2: { id: 2, user_id: String(CUSTOMER_ID), status: "processing" },
  3: { id: 3, user_id: "99", status: "pending" },
};

const seen = {};
stub(
  "../controllers/orderController",
  new Proxy(
    {},
    {
      get: (_, name) => (req, res) => {
        seen[name] = { body: req.body };
        res.status(200).json({ reached: String(name) });
      },
    },
  ),
);
stub("../db/orders", {
  getOrder: async (pool, id) => orders[id] || null,
  getOrderByNumber: async () => null,
});

const express = require("express");
const orderRoutes = require("../routes/orders");

// Every test runs with the old flag set, to prove it no longer grants access.
process.env.BYPASS_AUTH = "true";

const runQuery = async (sql, params) => {
  if (sql.includes("admin_users")) {
    return { rows: [] };
  }
  if (sql.includes(".users")) {
    return { rows: params[0] === CUSTOMER_SUB ? [{ id: CUSTOMER_ID }] : [] };
  }
  return { rows: [] };
};
const pool = { query: runQuery, connect: async () => ({ query: runQuery, release() {} }) };

let server;
let baseUrl;

test.before(async () => {
  const app = express();
  app.use(express.json());
  // Stand in for the Lambda handler, which sets this header from the API Gateway identity.
  app.use((req, res, next) => {
    req.headers["x-cognito-authentication-provider"] =
      `cognito-idp.example.com/pool,cognito-idp.example.com/pool:CognitoSignIn:${CUSTOMER_SUB}`;
    req.pool = pool;
    next();
  });
  app.use("/orders", orderRoutes);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => new Promise((resolve) => server.close(resolve)));

const call = async (method, url, body) => {
  const res = await fetch(`${baseUrl}${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

test("a customer can cancel their own pending order", async () => {
  const res = await call("PUT", "/orders/1", { status: "cancelled" });
  assert.equal(res.status, 200);
  assert.deepEqual(seen.updateOrder.body, { status: "cancelled" });
});

for (const status of ["processing", "shipped", "delivered", "refunded"]) {
  test(`a customer cannot set their order to ${status}`, async () => {
    assert.equal((await call("PUT", "/orders/1", { status })).status, 403);
  });
}

test("a customer cannot change order fields such as the total", async () => {
  assert.equal((await call("PUT", "/orders/1", { status: "cancelled", totalAmount: 1 })).status, 403);
  assert.equal((await call("PUT", "/orders/1", { totalAmount: 1 })).status, 403);
});

test("a customer cannot cancel an order that is already being processed", async () => {
  assert.equal((await call("PUT", "/orders/2", { status: "cancelled" })).status, 400);
});

test("a customer still cannot touch someone else's order", async () => {
  assert.equal((await call("PUT", "/orders/3", { status: "cancelled" })).status, 403);
});

test("a customer cannot delete an order", async () => {
  assert.equal((await call("DELETE", "/orders/1")).status, 403);
});

test("a customer cannot change a payment, such as marking it completed", async () => {
  assert.equal((await call("PUT", "/orders/1/payments/5", { status: "completed" })).status, 403);
});

test("a customer can still place an order and record a payment", async () => {
  assert.equal((await call("POST", "/orders", { userId: String(CUSTOMER_ID) })).status, 200);
  assert.equal((await call("POST", "/orders/1/payments", { paymentMethod: "bank_transfer", amount: 5 })).status, 200);
});
