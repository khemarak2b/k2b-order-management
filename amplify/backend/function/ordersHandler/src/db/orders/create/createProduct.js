const createProduct = async (pool, data) => {
    const client = await pool.connect();
    const schema = process.env.ENVIRONMENT || 'dev';
    
    try {
        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        
        const query = `
            INSERT INTO ${schema}.products (${columns.join(', ')})
            VALUES (${placeholders})
            RETURNING *
        `;
        
        const result = await client.query(query, values);
        return result.rows[0];
    } finally {
        client.release();
    }
};

module.exports = createProduct;
