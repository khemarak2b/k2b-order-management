const getUserInvoices = async (pool, userId, filters = {}) => {
  const client = await pool.connect();
  const schema = process.env.ENVIRONMENT || "dev";

  try {
    const { status, payment_status, limit = 50, offset = 0 } = filters;

    let query = `
      SELECT 
        id, invoice_number, order_id, user_id, invoice_date, due_date,
        subtotal, gst_amount, discount_amount, total_amount,
        amount_paid, amount_due, currency_code, status, payment_status,
        created_at, updated_at
      FROM ${schema}.invoices
      WHERE user_id = $1 AND deleted_at IS NULL
    `;

    const params = [userId];
    let paramCount = 1;

    if (status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      params.push(status);
    }

    if (payment_status) {
      paramCount++;
      query += ` AND payment_status = $${paramCount}`;
      params.push(payment_status);
    }

    query += ` ORDER BY invoice_date DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await client.query(query, params);

    return result.rows;
  } finally {
    client.release();
  }
};

module.exports = getUserInvoices;
