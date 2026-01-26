const updateOrder = async (pool, data) => {
  const client = await pool.connect();
  const schema = process.env.ENVIRONMENT || "dev";

  try {
    const { id, ...fields } = data;
    const columns = Object.keys(fields);
    const values = Object.values(fields);

    if (columns.length === 0) {
      throw new Error("No fields to update");
    }

    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(", ");

    const query = `
            UPDATE ${schema}.orders
            SET ${setClause}, updated_at = NOW()
            WHERE id = $${columns.length + 1}
            RETURNING *
        `;

    const result = await client.query(query, [...values, id]);
    return result.rows[0] || null;
  } finally {
    client.release();
  }
};

module.exports = updateOrder;
