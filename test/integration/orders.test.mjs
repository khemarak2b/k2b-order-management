import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { startDb, requireHandler, insertUser, insertAdmin, insertVariant } from "./helpers.mjs";

const createOrder = requireHandler("./ordersHandler/src/db/orders/create/createOrder");
const getOrders = requireHandler("./ordersHandler/src/db/orders/read/getOrders");
const updateOrder = requireHandler("./ordersHandler/src/db/orders/update/updateOrder");
const getReservedQuantityByVariant = requireHandler("./ordersHandler/src/db/orders/read/getReservedQuantityByVariant");

let db;
before(async () => {
  db = await startDb();
});
after(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
});

const order = (user, items, extra = {}) => ({
  user_id: String(user.id),
  order_number: `ORD-${Math.random().toString(36).slice(2, 10)}`,
  status: "pending",
  currency_code: "AUD",
  order_items: items,
  ...extra,
});
const item = (variant, quantity, name = "Widget") => ({ variant_id: variant.id, quantity, product_name: name });

test("createOrder prices each line from the database (D-24) and stores the order and items", async () => {
  const user = await insertUser(db);
  const a = await insertVariant(db, { price: "20.00", variantWholesale: "12.50", productWholesale: "15.00" });
  const b = await insertVariant(db, { price: "20.00", variantWholesale: "0", productWholesale: "15.00" });
  const c = await insertVariant(db, { price: "9.99" });

  const result = await createOrder(db.pool, order(user, [item(a.variant, 2), item(b.variant, 1), item(c.variant, 3)]));

  assert.deepEqual(result.items.map((i) => [Number(i.price), i.quantity, Number(i.line_total)]), [
    [12.5, 2, 25], // variant wholesale wins
    [15, 1, 15], // zero variant wholesale falls back to product wholesale
    [9.99, 3, 29.97], // no wholesale price: the variant price
  ]);
  assert.equal(Number(result.order.subtotal), 69.97);
  assert.equal(Number(result.order.total_amount), 69.97);

  const [stored] = await getOrders(db.pool, String(user.id));
  assert.equal(stored.id, result.order.id);
  assert.equal(stored.items.length, 3);
  assert.deepEqual(stored.payments, []);
  assert.equal(stored.created_by_admin_name, null);
});

test("a client-sent price is ignored", async () => {
  const user = await insertUser(db);
  const { variant } = await insertVariant(db, { price: "50.00" });
  const result = await createOrder(db.pool, order(user, [{ ...item(variant, 1), price: 0.01, line_total: 0.01 }]));
  assert.equal(Number(result.items[0].price), 50);
  assert.equal(Number(result.order.total_amount), 50);
});

test("an unknown variant fails the whole order and leaves nothing behind", async () => {
  const user = await insertUser(db);
  const { variant } = await insertVariant(db);
  await assert.rejects(
    createOrder(db.pool, order(user, [item(variant, 1), { variant_id: 999999, quantity: 1, product_name: "Ghost" }])),
    (err) => err.statusCode === 400 && /999999 not found/.test(err.message),
  );
  assert.equal((await db.query("SELECT count(*)::int AS n FROM dev.orders")).rows[0].n, 0);
});

test("a database error mid-order rolls back the order row too", async () => {
  const user = await insertUser(db);
  const { variant } = await insertVariant(db);
  // order_items.product_name is NOT NULL in the real schema; the order insert has already happened.
  await assert.rejects(createOrder(db.pool, order(user, [{ variant_id: variant.id, quantity: 1 }])), /product_name/);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM dev.orders")).rows[0].n, 0);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM dev.order_items")).rows[0].n, 0);
});

test("getOrders shows who placed an admin-created order", async () => {
  const user = await insertUser(db);
  const admin = await insertAdmin(db, { first_name: "Grace", last_name: "Hopper" });
  const { variant } = await insertVariant(db);
  await createOrder(db.pool, order(user, [item(variant, 1)], { created_by_admin: true, created_by_admin_id: admin.id }));

  const [stored] = await getOrders(db.pool, String(user.id));
  assert.equal(stored.created_by_admin_name, "Grace Hopper");
  assert.equal(stored.created_by_admin_email, admin.email);
});

test("stock reserved by open orders counts pending and processing only, and drops on cancel", async () => {
  const user = await insertUser(db);
  const { variant } = await insertVariant(db);
  const first = await createOrder(db.pool, order(user, [item(variant, 4)]));
  const second = await createOrder(db.pool, order(user, [item(variant, 3)]));
  await db.query("UPDATE dev.orders SET status = 'processing' WHERE id = $1", [second.order.id]);
  const shipped = await createOrder(db.pool, order(user, [item(variant, 10)]));
  await db.query("UPDATE dev.orders SET status = 'shipped' WHERE id = $1", [shipped.order.id]);

  assert.equal((await getReservedQuantityByVariant(db.pool, [variant.id])).get(variant.id), 7);

  await updateOrder(db.pool, { id: first.order.id, status: "cancelled" });
  assert.equal((await getReservedQuantityByVariant(db.pool, [variant.id])).get(variant.id), 3);
});

test("a customer update can change only the status", async () => {
  const user = await insertUser(db);
  const { variant } = await insertVariant(db);
  const { order: created } = await createOrder(db.pool, order(user, [item(variant, 1)]));

  const updated = await updateOrder(db.pool, { id: created.id, status: "cancelled", total_amount: 0, user_id: "999" });
  assert.equal(updated.status, "cancelled");
  assert.equal(Number(updated.total_amount), Number(created.total_amount));
  assert.equal(updated.user_id, created.user_id);
});
