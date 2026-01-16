const getPayment = async (pool, paymentId, orderId) => {
  const client = await pool.connect();
  const schema = process.env.ENVIRONMENT || 'dev';

  try {
    const query = `
      SELECT * FROM ${schema}.payments
      WHERE id = $1 AND order_id = $2
    `;

    const result = await client.query(query, [paymentId, orderId]);
    return result.rows[0] || null;
  } finally {
    client.release();
  }
};

module.exports = getPayment;
