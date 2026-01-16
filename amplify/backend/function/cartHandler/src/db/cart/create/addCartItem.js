const addCartItem = async (pool, userId, itemData) => {
  const client = await pool.connect();
  const schema = process.env.ENVIRONMENT || "dev";

  try {
    await client.query("BEGIN");

    // Get or create cart for user
    const cartResult = await client.query(`SELECT id FROM ${schema}.carts WHERE user_id = $1`, [userId]);

    let cartId;

    if (cartResult.rows.length === 0) {
      // Create cart if doesn't exist
      const newCartResult = await client.query(`INSERT INTO ${schema}.carts (user_id) VALUES ($1) RETURNING id`, [
        userId,
      ]);
      cartId = newCartResult.rows[0].id;
    } else {
      cartId = cartResult.rows[0].id;
      // Update cart's updated_at timestamp
      await client.query(`UPDATE ${schema}.carts SET updated_at = NOW() WHERE id = $1`, [cartId]);
    }

    // Add item to cart
    const { cart_id, id, ...fields } = itemData; // Strip cart_id and id (shouldn't be present on add)
    const cols = Object.keys(fields);
    const vals = Object.values(fields);

    const result = await client.query(
      `
      INSERT INTO ${schema}.cart_items (cart_id, ${cols.join(", ")})
      VALUES ($1, ${cols.map((_, i) => `$${i + 2}`).join(", ")})
      RETURNING *
      `,
      [cartId, ...vals]
    );

    await client.query("COMMIT");
    return result.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

module.exports = addCartItem;
