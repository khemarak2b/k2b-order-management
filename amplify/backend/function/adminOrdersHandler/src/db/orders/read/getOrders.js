const getOrders = async (pool, userId) => {
  const client = await pool.connect();
  const schema = process.env.ENVIRONMENT || "dev";

  try {
    // Get all orders for user
    const ordersResult = await client.query(
      `
        SELECT
          o.*,
          CASE
            WHEN o.created_by_admin AND o.created_by_admin_id IS NOT NULL
              THEN TRIM(COALESCE(au.first_name, '') || ' ' || COALESCE(au.last_name, ''))
            ELSE NULL
          END AS created_by_admin_name,
          au.email AS created_by_admin_email,
          pp.name AS pricing_profile_name
        FROM ${schema}.orders o
        LEFT JOIN ${schema}.admin_users au ON au.id = o.created_by_admin_id
        LEFT JOIN ${schema}.pricing_profiles pp ON pp.id = o.pricing_profile_id
        WHERE o.user_id = $1
        ORDER BY o.created_at DESC
      `,
      [userId],
    );

    if (ordersResult.rows.length === 0) {
      return [];
    }

    // Get items and payments for each order
    const orders = await Promise.all(
      ordersResult.rows.map(async (order) => {
        const itemsResult = await client.query(
          `SELECT * FROM ${schema}.order_items
                     WHERE order_id = $1
                     ORDER BY id ASC`,
          [order.id],
        );

        const paymentsResult = await client.query(
          `SELECT * FROM ${schema}.payments
                     WHERE order_id = $1
                     ORDER BY created_at DESC`,
          [order.id],
        );

        return {
          ...order,
          items: itemsResult.rows,
          payments: paymentsResult.rows,
        };
      }),
    );

    return orders;
  } finally {
    client.release();
  }
};

module.exports = getOrders;
