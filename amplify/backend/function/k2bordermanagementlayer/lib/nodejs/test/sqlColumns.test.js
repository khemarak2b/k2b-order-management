const assert = require("node:assert/strict");
const test = require("node:test");
const { assertSafeColumns, pickColumns } = require("../utils/sqlColumns");

test("plain column names pass", () => {
  assert.deepEqual(assertSafeColumns(["quantity", "unit_price", "address_line_1"]), [
    "quantity",
    "unit_price",
    "address_line_1",
  ]);
});

test("anything that could change the SQL is refused", () => {
  for (const column of [
    "quantity = 0, price",
    "quantity = (SELECT password FROM dev.users LIMIT 1)",
    "price) VALUES (0); --",
    'quantity"',
    "Quantity",
    "quantity ",
    "dev.users",
    "1quantity",
    "",
    "a".repeat(64),
    null,
    42,
  ]) {
    assert.throws(() => assertSafeColumns([column]), (error) => error.status === 400, String(column));
  }
});

test("pickColumns keeps only allowed, defined keys", () => {
  const body = { quantity: 2, price: 0, cart_id: 99, "quantity = 0, price": 1, image: undefined };
  assert.deepEqual(pickColumns(body, ["quantity", "image", "product_id"]), { quantity: 2 });
});

test("pickColumns ignores inherited keys", () => {
  const body = Object.create({ quantity: 5 });
  assert.deepEqual(pickColumns(body, ["quantity"]), {});
  assert.deepEqual(pickColumns(null, ["quantity"]), {});
});
