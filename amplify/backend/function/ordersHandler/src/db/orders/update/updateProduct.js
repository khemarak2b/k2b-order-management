const updateProduct = async (pool, id, data) => {
    const client = await pool.connect();
    const schema = process.env.ENVIRONMENT || 'dev';
    
    try {
        const columns = Object.keys(data);
        const values = Object.values(data);
        
        // Build SET clause: name = $1, description = $2, ...
        const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
        
        // Add id as last parameter
        values.push(id);
        const idIndex = values.length;
        
        const query = `
            UPDATE ${schema}.products 
            SET ${setClause}
            WHERE id = $${idIndex}
            RETURNING *
        `;
        
        const result = await client.query(query, values);
        return result.rows[0] || null;
    } finally {
        client.release();
    }
};

module.exports = updateProduct;
