const deleteInvoice = async (pool, id) => {
  const client = await pool.connect();
  const schema = process.env.ENVIRONMENT || "dev";

  try {
    // Soft delete - just mark as deleted
    const query = `
      UPDATE ${schema}.invoices
      SET deleted_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await client.query(query, [id]);

    if (result.rows.length === 0) {
      throw new Error("Invoice not found");
    }

    return result.rows[0];
  } finally {
    client.release();
  }
};

module.exports = deleteInvoice;
