const updateCart = async (pool, data) => {
  const client = await pool.connect();
  const schema = process.env.ENVIRONMENT || "dev";

  try {
    await client.query("BEGIN");

    /* ---------- GET OR CREATE CART ---------- */
    const { user_id } = data.cart;

    if (!user_id) {
      throw new Error("user_id is required");
    }

    // Get existing cart for user
    const cartResult = await client.query(
      `SELECT id FROM ${schema}.carts WHERE user_id = $1`,
      [user_id]
    );

    let cartId;

    if (cartResult.rows.length === 0) {
      // Create new cart if doesn't exist
      const newCartResult = await client.query(
        `INSERT INTO ${schema}.carts (user_id) VALUES ($1) RETURNING id`,
        [user_id]
      );
      cartId = newCartResult.rows[0].id;
    } else {
      cartId = cartResult.rows[0].id;
      // Update cart's updated_at timestamp
      await client.query(`UPDATE ${schema}.carts SET updated_at = NOW() WHERE id = $1`, [cartId]);
    }

    /* ---------- EXISTING CART ITEMS ---------- */
    const existingRes = await client.query(`SELECT id FROM ${schema}.cart_items WHERE cart_id = $1`, [cartId]);

    const existingIds = existingRes.rows.map((r) => r.id);
    const incomingIds = data.cart_items.filter((i) => i.id).map((i) => i.id);

    /* ---------- DELETE REMOVED ITEMS ---------- */
    const toDelete = existingIds.filter((id) => !incomingIds.includes(id));
    if (toDelete.length > 0) {
      await client.query(`DELETE FROM ${schema}.cart_items WHERE id = ANY($1)`, [toDelete]);
    }

    /* ---------- UPDATE / INSERT ITEMS ---------- */
    for (const item of data.cart_items) {
      if (item.id) {
        // UPDATE
        const { id, ...fields } = item;
        const cols = Object.keys(fields);
        const vals = Object.values(fields);

        const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(", ");

        await client.query(
          `
          UPDATE ${schema}.cart_items
          SET ${setClause}, updated_at = NOW()
          WHERE id = $${cols.length + 1}
          `,
          [...vals, id]
        );
      } else {
        // INSERT
        const { cart_id, ...fields } = item; // Remove cart_id from item
        const cols = Object.keys(fields);
        const vals = Object.values(fields);

        await client.query(
          `
          INSERT INTO ${schema}.cart_items (cart_id, ${cols.join(", ")})
          VALUES ($1, ${cols.map((_, i) => `$${i + 2}`).join(", ")})
          `,
          [cartId, ...vals]
        );
      }
    }

    await client.query("COMMIT");
    return { message: "Cart updated successfully", cart_id: cartId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

module.exports = updateCart;
