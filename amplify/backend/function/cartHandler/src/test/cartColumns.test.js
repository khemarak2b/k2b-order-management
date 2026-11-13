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

const addCartItem = require("../db/cart/create/addCartItem");
const updateCartItem = require("../db/cart/update/updateCartItem");
const createCart = require("../db/cart/create/createCart");

// Records every query and answers just enough for the cart functions to finish.
function fakePool() {
  const queries = [];
  const client = {
    async query(sql, values = []) {
      queries.push({ sql: String(sql), values });
      if (/^\s*SELECT id FROM/.test(sql)) return { rows: [{ id: 7 }] };
      if (/^\s*SELECT \* FROM .*carts/.test(sql)) return { rows: [{ id: 7, user_id: 1 }] };
      return { rows: [{ id: 1, cart_id: 7 }] };
    },
    release() {},
  };
  return { queries, pool: { connect: async () => client } };
}

const INJECTION = "quantity = (SELECT 1), price";

test("updateCartItem only ever sets quantity", async () => {
  const { pool, queries } = fakePool();
  await updateCartItem(pool, 5, { quantity: 3, price: 0, cart_id: 99, [INJECTION]: 0 });
  const sql = queries.at(-1).sql;
  assert.match(sql, /SET quantity = \$1, updated_at = NOW\(\)/);
  assert.doesNotMatch(sql, /price|cart_id|SELECT/);
  assert.deepEqual(queries.at(-1).values, [3, 5]);
});

test("updateCartItem with no allowed field is a 400 and runs no SQL", async () => {
  const { pool, queries } = fakePool();
  await assert.rejects(updateCartItem(pool, 5, { [INJECTION]: 1 }), (error) => error.status === 400);
  assert.equal(queries.length, 0);
});

test("addCartItem drops unknown and injected keys", async () => {
  const { pool, queries } = fakePool();
  await addCartItem(pool, 1, { product_id: 2, variant_id: 3, quantity: 1, cart_id: 99, id: 4, [INJECTION]: 0 });
  const insert = queries.find((q) => /INSERT INTO .*cart_items/.test(q.sql));
  assert.match(insert.sql, /\(cart_id, product_id, variant_id, quantity\)/);
  assert.doesNotMatch(insert.sql, /SELECT 1/);
  assert.deepEqual(insert.values, [7, 2, 3, 1]);
});

test("createCart inserts the cart by user_id and filters item keys", async () => {
  const { pool, queries } = fakePool();
  await createCart(pool, {
    cart: { user_id: 1 },
    cart_items: [{ product_id: 2, quantity: 1, [INJECTION]: 0 }],
  });
  const insert = queries.find((q) => /INSERT INTO .*cart_items/.test(q.sql));
  assert.match(insert.sql, /\(cart_id,product_id,quantity\)/);
  assert.doesNotMatch(insert.sql, /SELECT 1/);
});
