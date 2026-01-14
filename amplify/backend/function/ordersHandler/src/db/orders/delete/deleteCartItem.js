const deleteCartItem = async (pool, itemId) => {
  const client = await pool.connect();
  const schema = process.env.ENVIRONMENT || "dev";

  try {
    const result = await client.query(
      `DELETE FROM ${schema}.cart_items WHERE id = $1`,
      [itemId]
    );

    return result.rowCount > 0;
  } finally {
    client.release();
  }
};

module.exports = deleteCartItem;
