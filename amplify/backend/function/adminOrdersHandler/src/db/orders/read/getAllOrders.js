const getAllOrders = async (pool, filters = {}, limit = 20, offset = 0) => {
  const client = await pool.connect();
  const schema = process.env.ENVIRONMENT || "dev";

  try {
    // Build WHERE clause with multiple filters
    const whereClauses = [];
    const params = [];

    const {
      status,
      userId,
      minAmount,
      maxAmount,
      paymentStatus,
      createdAfter,
      createdBefore,
      updatedAfter,
      updatedBefore,
      orderNumber,
    } = filters;

    // Status filter
    if (status) {
      whereClauses.push(`o.status = $${params.length + 1}`);
      params.push(status);
    }

    // User ID filter
    if (userId) {
      whereClauses.push(`o.user_id = $${params.length + 1}`);
      params.push(userId);
    }

    // Amount range filters
    if (minAmount !== undefined && minAmount !== null) {
      whereClauses.push(`o.total_amount >= $${params.length + 1}`);
      params.push(minAmount);
    }

    if (maxAmount !== undefined && maxAmount !== null) {
      whereClauses.push(`o.total_amount <= $${params.length + 1}`);
      params.push(maxAmount);
    }

    // Date range filters
    if (createdAfter) {
      whereClauses.push(`o.created_at >= $${params.length + 1}`);
      params.push(createdAfter);
    }

    if (createdBefore) {
      whereClauses.push(`o.created_at <= $${params.length + 1}`);
      params.push(createdBefore);
    }

    if (updatedAfter) {
      whereClauses.push(`o.updated_at >= $${params.length + 1}`);
      params.push(updatedAfter);
    }

    if (updatedBefore) {
      whereClauses.push(`o.updated_at <= $${params.length + 1}`);
      params.push(updatedBefore);
    }

    // Payment status filter
    if (paymentStatus) {
      whereClauses.push(
        `EXISTS (SELECT 1 FROM ${schema}.payments WHERE order_id = o.id AND status = $${params.length + 1})`,
      );
      params.push(paymentStatus);
    }

    // Order number filter
    if (orderNumber) {
      whereClauses.push(`o.order_number ILIKE $${params.length + 1}`);
      params.push(`%${orderNumber}%`);
    }

    const whereClause = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(" AND ")}` : "";

    // Get total count
    const countResult = await client.query(`SELECT COUNT(*) as count FROM ${schema}.orders o${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated orders
    const countParams = params.length;
    const ordersResult = await client.query(
      `SELECT
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
       ${whereClause}
       ORDER BY o.created_at DESC
       LIMIT $${countParams + 1} OFFSET $${countParams + 2}`,
      [...params, limit, offset],
    );

    if (ordersResult.rows.length === 0) {
      return { orders: [], total, limit, offset };
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

    return {
      orders,
      total,
      limit,
      offset,
    };
  } finally {
    client.release();
  }
};

module.exports = getAllOrders;
