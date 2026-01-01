const updateCart = async (pool, id, data) => {
    const client = await pool.connect();
    const schema = process.env.ENVIRONMENT || 'dev';
    
    try {
        const columnsOrder = Object.keys(data);
        const valuesOrder = Object.values(data);
        
        // Build SET clause: name = $1, description = $2, ...
        const setClause = columnsOrder.map((col, i) => `${col} = $${i + 1}`).join(', ');
        
        // Add id as last parameter
        valuesOrder.push(id);
        const idIndex = valuesOrder.length;
        
        const query = `
            UPDATE ${schema}.orders 
            SET ${setClause}
            WHERE id = $${idIndex}
            RETURNING *
        `;
        
        const result = await client.query(query, valuesOrder);
        return result.rows[0] || null;
    } finally {
        client.release();
    }
};

module.exports = updateCart;
