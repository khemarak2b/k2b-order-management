const updateCartItem = async (pool, itemId, updateData) => {
  const client = await pool.connect();
  const schema = process.env.ENVIRONMENT || "dev";

  try {
    // Strip out id and cart_id from update data
    const { id, cart_id, ...fields } = updateData;

    const cols = Object.keys(fields);
    const vals = Object.values(fields);

    if (cols.length === 0) {
      throw new Error("No fields to update");
    }

    const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(", ");

    const result = await client.query(
      `
      UPDATE ${schema}.cart_items
      SET ${setClause}, updated_at = NOW()
      WHERE id = $${cols.length + 1}
      RETURNING *
      `,
      [...vals, itemId]
    );

    if (result.rows.length === 0) {
      throw new Error("Cart item not found");
    }

    return result.rows[0];
  } finally {
    client.release();
  }
};

module.exports = updateCartItem;
