import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { startDb, requireHandler, insertUser, insertVariant } from "./helpers.mjs";

const getCart = requireHandler("./ordersHandler/src/db/orders/read/getCart");
const deleteCart = requireHandler("./ordersHandler/src/db/orders/delete/deleteCart");
const { getUserIdByCognitoSub } = requireHandler("./ordersHandler/src/db/users");

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

async function cartWithItems(user, variants) {
  const cart = (await db.query("INSERT INTO dev.carts (user_id) VALUES ($1) RETURNING *", [String(user.id)])).rows[0];
  for (const { product, variant } of variants) {
    await db.query(
      `INSERT INTO dev.cart_items (cart_id, product_id, variant_id, product_name, price, quantity)
       VALUES ($1, $2, $3, $4, $5, 2)`,
      [cart.id, product.id, variant.id, product.name, variant.price],
    );
  }
  return cart;
}

test("getCart returns the user's cart with its items", async () => {
  const user = await insertUser(db);
  const other = await insertUser(db);
  const cart = await cartWithItems(user, [await insertVariant(db), await insertVariant(db)]);
  await cartWithItems(other, [await insertVariant(db)]);

  const result = await getCart(db.pool, String(user.id));
  assert.equal(result.id, cart.id);
  assert.equal(result.items.length, 2);
  assert.ok(result.items.every((i) => i.cart_id === cart.id));
  assert.equal(await getCart(db.pool, "424242"), null);
});

test("deleteCart removes the cart and its items, and only that user's", async () => {
  const user = await insertUser(db);
  const other = await insertUser(db);
  await cartWithItems(user, [await insertVariant(db)]);
  const otherCart = await cartWithItems(other, [await insertVariant(db)]);

  assert.equal(await deleteCart(db.pool, String(user.id)), true);
  assert.equal(await getCart(db.pool, String(user.id)), null);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM dev.cart_items")).rows[0].n, 1);
  assert.equal((await getCart(db.pool, String(other.id))).id, otherCart.id);
  assert.equal(await deleteCart(db.pool, String(user.id)), false);
});

test("a Cognito sub maps to the database user, and an unknown sub is rejected", async () => {
  const user = await insertUser(db, { cognito_sub: "abc-123" });
  assert.equal(await getUserIdByCognitoSub(db.pool, "abc-123"), user.id);
  await assert.rejects(getUserIdByCognitoSub(db.pool, "nope"), /User not found/);
});
