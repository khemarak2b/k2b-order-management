const updateCart = async (pool, data) => {
  const client = await pool.connect();
  const schema = process.env.ENVIRONMENT || "dev";

  try {
    await client.query("BEGIN");

    /* ---------- UPDATE CART ---------- */
    const { id, ...cartFields } = data.cart;
    const cartId = id;

    const cartColumns = Object.keys(cartFields);
    const cartValues = Object.values(cartFields);

    if (cartColumns.length > 0) {
      const setClause = cartColumns.map((col, i) => `${col} = $${i + 1}`).join(", ");

      cartColumns.push("updated_at");
      cartValues.push(new Date());

      await client.query(
        `
                UPDATE ${schema}.carts
                SET ${setClause}, updated_at = NOW()
                WHERE id = $${cartColumns.length}
                `,
        [...cartValues, cartId]
      );
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
        const cols = Object.keys(item);
        const vals = Object.values(item);

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
    return { message: "Cart updated successfully" };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

module.exports = updateCart;
