const deleteOrder = async (pool, id) => {
    const client = await pool.connect();
    const schema = process.env.ENVIRONMENT || 'dev';
    
    try {
        await client.query('BEGIN');
        await client.query(`DELETE FROM ${schema}.order_items WHERE order_id = $1`, [id]);
        const result = await client.query(`DELETE FROM ${schema}.orders WHERE id = $1`, [id]);
        await client.query('COMMIT');
        return result.rowCount > 0;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

module.exports = deleteOrder;
