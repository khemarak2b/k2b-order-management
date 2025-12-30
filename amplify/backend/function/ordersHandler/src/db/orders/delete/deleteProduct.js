const deleteProduct = async (pool, id) => {
    const client = await pool.connect();
    const schema = process.env.ENVIRONMENT || 'dev';
    
    try {
        const result = await client.query(
            `DELETE FROM ${schema}.products WHERE id = $1`,
            [id]
        );
        return result.rowCount > 0;
    } finally {
        client.release();
    }
};

module.exports = deleteProduct;
