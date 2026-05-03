const getOrderByNumber = async (pool, orderNumber) => {
  const client = await pool.connect();
  const schema = process.env.ENVIRONMENT || "dev";

  try {
    const orderResult = await client.query(
      `SELECT * FROM ${schema}.orders WHERE order_number = $1`,
      [orderNumber]
    );

    if (orderResult.rows.length === 0) {
      return null;
    }

    const order = orderResult.rows[0];

    const orderItemsResult = await client.query(
      `SELECT * FROM ${schema}.order_items
             WHERE order_id = $1
             ORDER BY id ASC`,
      [order.id]
    );

    const paymentsResult = await client.query(
      `SELECT * FROM ${schema}.payments
             WHERE order_id = $1
             ORDER BY created_at DESC`,
      [order.id]
    );

    return {
      ...order,
      items: orderItemsResult.rows,
      payments: paymentsResult.rows,
    };
  } finally {
    client.release();
  }
};

module.exports = getOrderByNumber;
