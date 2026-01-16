const getOrders = async (pool, userId) => {
    const client = await pool.connect();
    const schema = process.env.ENVIRONMENT || 'dev';

    try {
        // Get all orders for user
        const ordersResult = await client.query(
            `SELECT * FROM ${schema}.orders
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [userId]
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
                    items: itemsResult.rows,
                    payments: paymentsResult.rows
                };
            })
        );

        return orders;
    } finally {
        client.release();
    }
};

module.exports = getOrders;
