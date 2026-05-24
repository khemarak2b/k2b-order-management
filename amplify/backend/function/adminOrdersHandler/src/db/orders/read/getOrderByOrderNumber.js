const getAdminChangeLog = require("./getAdminChangeLog");

const getOrderByOrderNumber = async (pool, orderNumber) => {
  const client = await pool.connect();
  const schema = process.env.ENVIRONMENT || "dev";

  try {
    const orderResult = await client.query(
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
        WHERE o.order_number = $1
      `,
      [orderNumber],
    );

    if (orderResult.rows.length === 0) {
      return null;
    }

    const order = orderResult.rows[0];

    const orderItemsResult = await client.query(
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

    const changeLog = await getAdminChangeLog(client, order.id, schema);

    return {
      ...order,
      items: orderItemsResult.rows,
      payments: paymentsResult.rows,
      change_log: changeLog,
    };
  } finally {
    client.release();
  }
};

module.exports = getOrderByOrderNumber;
