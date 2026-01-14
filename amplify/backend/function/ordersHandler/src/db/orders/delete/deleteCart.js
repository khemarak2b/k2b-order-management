const deleteCart = async (pool, userId) => {
  const client = await pool.connect();
  const schema = process.env.ENVIRONMENT || "dev";

  try {
    await client.query("BEGIN");

    // Get cart
    const cartResult = await client.query(
      `SELECT id FROM ${schema}.carts WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1`,
      [userId]
    );

    if (cartResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return false;
    }

    const cartId = cartResult.rows[0].id;

    // Delete cart items first (cascade will handle this too, but explicit for clarity)
    await client.query(`DELETE FROM ${schema}.cart_items WHERE cart_id = $1`, [cartId]);

    // Delete cart
    const result = await client.query(`DELETE FROM ${schema}.carts WHERE id = $1`, [cartId]);

    await client.query("COMMIT");
    return result.rowCount > 0;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

module.exports = deleteCart;
