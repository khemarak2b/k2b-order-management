const deleteOrder = async (pool, id) => {
    const client = await pool.connect();
    const schema = process.env.ENVIRONMENT || 'dev';
    
    try {

        const result_order_items = await client.query(
            `DELETE FROM ${schema}.orders WHERE order_id = $1`,
            [id]
        );

        const result_orders = await client.query(
            `DELETE FROM ${schema}.order_items WHERE order_id = $1`,
            [id]
        );
        return result_orders.rowCount > 0;
    } finally {
        client.release();
    }
};

module.exports = deleteOrder;
