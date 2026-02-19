const getInvoicePayments = async (pool, invoiceId, options = {}) => {
  const client = await pool.connect();
  const schema = process.env.ENVIRONMENT || "dev";
  const { limit = 50, offset = 0 } = options;

  try {
    // Get payment history with pagination
    const paymentsResult = await client.query(
      `SELECT * FROM ${schema}.invoice_payments 
       WHERE invoice_id = $1 
       ORDER BY payment_date DESC 
       LIMIT $2 OFFSET $3`,
      [invoiceId, limit, offset]
    );

    // Get total count
    const countResult = await client.query(
      `SELECT COUNT(*) as total FROM ${schema}.invoice_payments WHERE invoice_id = $1`,
      [invoiceId]
    );

    return {
      payments: paymentsResult.rows,
      total: parseInt(countResult.rows[0].total),
      limit,
      offset,
    };
  } finally {
    client.release();
  }
};

module.exports = getInvoicePayments;
