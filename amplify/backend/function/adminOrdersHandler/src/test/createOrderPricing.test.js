const assert = require("node:assert/strict");
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
  return originalResolve.call(this, request, ...rest);
};

// Deployed Lambdas always set this (F0.6); the queries use it as the schema.
process.env.ENVIRONMENT = "dev";
const createOrder = require("../db/orders/create/createOrder");

// Answers the variant lookup with `variantRow` and records every query.
function fakePool(variantRow) {
  const queries = [];
  const client = {
    async query(sql, values = []) {
      queries.push({ sql: String(sql), values });
      if (/FROM .*product_variants pv/.test(sql)) return { rows: [variantRow] };
      if (/INSERT INTO .*\.orders/.test(sql)) return { rows: [{ id: 99 }] };
      if (/INSERT INTO .*order_items/.test(sql)) return { rows: [{ order_id: 99 }] };
      return { rows: [] };
    },
    release() {},
  };
  return { queries, pool: { connect: async () => client } };
}

const ORDER = { user_id: 1, order_items: [{ variant_id: 5, quantity: 2 }] };

test("the variant lookup uses the D-24 catalogue price (wholesale first, then the Shopify price)", async () => {
  const { pool, queries } = fakePool({ id: 5, product_id: 1, base_price: "4.00", override_price: null });
  await createOrder(pool, ORDER);
  const lookup = queries.find((q) => /product_variants pv/.test(q.sql)).sql;
  assert.match(lookup, /COALESCE\(NULLIF\(pv\.wholesale_price, 0\), NULLIF\(p\.wholesale_price, 0\), pv\.price\) AS base_price/);
  assert.match(lookup, /JOIN dev\.products p ON p\.id = pv\.product_id/);
});

test("without a profile override the order is charged the catalogue price", async () => {
  const { pool, queries } = fakePool({ id: 5, product_id: 1, base_price: "4.00", override_price: null });
  await createOrder(pool, ORDER);
  const insert = queries.find((q) => /INSERT INTO .*\.orders/.test(q.sql));
  const subtotal = insert.values[insert.sql.match(/\(([^)]*)\)/)[1].split(", ").indexOf("subtotal")];
  assert.equal(subtotal, 8);
});

test("a pricing-profile override still wins over the catalogue price", async () => {
  const { pool, queries } = fakePool({ id: 5, product_id: 1, base_price: "4.00", override_price: "3.25" });
  await createOrder(pool, ORDER);
  const insert = queries.find((q) => /INSERT INTO .*\.orders/.test(q.sql));
  const subtotal = insert.values[insert.sql.match(/\(([^)]*)\)/)[1].split(", ").indexOf("subtotal")];
  assert.equal(subtotal, 6.5);
});
