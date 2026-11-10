const assert = require("node:assert/strict");
const test = require("node:test");
const createOrder = require("../db/orders/create/createOrder");

const VARIANTS = {
  11: { id: 11, product_id: 1, price: "12.50" },
  12: { id: 12, product_id: 2, price: "3.10" },
};

const fakePool = () => {
  const calls = [];
  const client = {
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      if (sql.includes("FROM dev.product_variants")) {
        const variant = VARIANTS[params[0]];
        return { rows: variant ? [variant] : [] };
      }
      if (sql.includes("INSERT INTO dev.orders")) {
        const columns = sql.match(/orders \(([^)]+)\)/)[1].split(", ");
        return { rows: [{ id: 500, ...Object.fromEntries(columns.map((c, i) => [c, params[i]])) }] };
      }
      if (sql.includes("INSERT INTO dev.order_items")) {
        return { rows: [{ inserted: true }] };
      }
      return { rows: [] };
    },
    release() {},
  };
  return { pool: { connect: async () => client }, calls };
};

const baseOrder = {
  user_id: "10",
  order_number: "ORD-1",
  status: "pending",
  currency_code: "AUD",
  shipping_address: {},
  billing_address: {},
};

test("totals come from database prices, not from the client", async () => {
  const { pool, calls } = fakePool();
  const result = await createOrder(pool, {
    ...baseOrder,
    total_amount: 0.01,
    subtotal: 0.01,
    order_items: [
      { variant_id: 11, quantity: 2, price: 0.01, product_name: "Tea" },
      { variant_id: 12, quantity: 3, price: 0.01, product_name: "Cups" },
    ],
  });

  // 2 x 12.50 + 3 x 3.10
  assert.equal(result.order.subtotal, 34.3);
  assert.equal(result.order.total_amount, 34.3);
  assert.equal(result.order.tax_amount, 0);
  assert.equal(result.order.discount_amount, 0);

  const itemInsert = calls.find((c) => c.sql.includes("INSERT INTO dev.order_items"));
  assert.ok(itemInsert.params.includes(12.5));
  assert.ok(!itemInsert.params.includes(0.01));
  assert.ok(calls.some((c) => c.sql === "COMMIT"));
});

test("charges the wholesale price checkout shows, falling back to the variant price", async () => {
  const { pool, calls } = fakePool();
  await createOrder(pool, { ...baseOrder, order_items: [{ variant_id: 11, quantity: 1 }] });
  const priceQuery = calls.find((c) => c.sql.includes("FROM dev.product_variants"));
  assert.match(
    priceQuery.sql.replace(/\s+/g, " "),
    /COALESCE\(NULLIF\(pv\.wholesale_price, 0\), NULLIF\(p\.wholesale_price, 0\), pv\.price\) AS price/,
  );
  assert.match(priceQuery.sql, /JOIN dev\.products p ON p\.id = pv\.product_id/);
});

test("the product comes from the variant, not from the client", async () => {
  const { pool, calls } = fakePool();
  await createOrder(pool, { ...baseOrder, order_items: [{ variant_id: 11, product_id: 999, quantity: 1 }] });
  const itemInsert = calls.find((c) => c.sql.includes("INSERT INTO dev.order_items"));
  assert.ok(itemInsert.params.includes(1));
  assert.ok(!itemInsert.params.includes(999));
});

test("unknown item fields cannot become SQL columns", async () => {
  const { pool, calls } = fakePool();
  await createOrder(pool, {
    ...baseOrder,
    order_items: [{ variant_id: 11, quantity: 1, "line_total) VALUES (1); DROP TABLE x; --": 1 }],
  });
  const itemInsert = calls.find((c) => c.sql.includes("INSERT INTO dev.order_items"));
  assert.doesNotMatch(itemInsert.sql, /DROP/);
});

test("bad quantities and unknown variants are refused with a 400", async () => {
  for (const item of [
    { variant_id: 11, quantity: 0 },
    { variant_id: 11, quantity: -2 },
    { variant_id: 11, quantity: 1.5 },
    { variant_id: 404, quantity: 1 },
  ]) {
    const { pool } = fakePool();
    await assert.rejects(createOrder(pool, { ...baseOrder, order_items: [item] }), (error) => error.statusCode === 400);
  }
});

test("an order with no items is refused", async () => {
  const { pool } = fakePool();
  await assert.rejects(createOrder(pool, { ...baseOrder, order_items: [] }), (error) => error.statusCode === 400);
});
