const getOrder = async (pool, id) => {
    const client = await pool.connect();
    const schema = process.env.ENVIRONMENT || 'dev';

    try {
        // Get order
        const orderResult = await client.query(
            `SELECT * FROM ${schema}.orders WHERE id = $1`,
            [id]
        );

        if (orderResult.rows.length === 0) {
            return null;
        }

        const order = orderResult.rows[0];

        // Get order items
        const orderItemsResult = await client.query(
            `SELECT * FROM ${schema}.order_items
             WHERE order_id = $1
             ORDER BY id ASC`,
            [id]
        );

        // Get payments
        const paymentsResult = await client.query(
            `SELECT * FROM ${schema}.payments
             WHERE order_id = $1
             ORDER BY created_at DESC`,
            [id]
        );

        return {
            ...order,
            items: orderItemsResult.rows,
            payments: paymentsResult.rows
        };
    } finally {
        client.release();
    }
};

module.exports = getOrder;
