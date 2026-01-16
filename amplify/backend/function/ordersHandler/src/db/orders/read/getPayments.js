const getPayments = async (pool, orderId) => {
  const client = await pool.connect();
  const schema = process.env.ENVIRONMENT || 'dev';

  try {
    const query = `
      SELECT * FROM ${schema}.payments
      WHERE order_id = $1
      ORDER BY created_at DESC
    `;

    const result = await client.query(query, [orderId]);
    return result.rows;
  } finally {
    client.release();
  }
};

module.exports = getPayments;
