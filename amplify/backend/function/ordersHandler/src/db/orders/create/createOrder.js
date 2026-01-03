const createOrder = async (pool, data) => {
    const client = await pool.connect();
    const schema = process.env.ENVIRONMENT || 'dev';

    try {
        const columnsOrder = Object.keys(data.order);
        const valuesOrder = Object.values(data.order);
        const placeholders = columnsOrder.map((_, i) => `$${i + 1}`).join(', ');
        await client.query('BEGIN');

        const queryOrders = `
            INSERT INTO ${schema}.orders (${columnsOrder.join(', ')})
            VALUES (${placeholders})
            RETURNING *
        `;
        const resultOrders = await client.query(queryOrders, valuesOrder);
        const orderId = resultOrders.rows[0].order_id; 

        // ---------- INSERT ORDER ITEMS ----------
        if (data.orderItems && data.orderItems.length > 0) {
            const columnsOrderItems = Object.keys(data.orderItems[0]);

            // Ensure order_id is included in the items
            if (!columnsOrderItems.includes('order_id')) {
                columnsOrderItems.unshift('order_id'); // add at start
            }

            const valuesOrderItems = [];
            const placeholdersItems = data.orderItems
                .map(item => {
                    const rowPlaceholders = columnsOrderItems.map(col => {
                        let value;
                        if (col === 'order_id') {
                            value = orderId; // set parent order_id
                        } else {
                            value = item[col] === undefined ? null : item[col];
                        }
                        valuesOrderItems.push(value);
                        return `$${valuesOrderItems.length}`; 
                    });
                    return `(${rowPlaceholders.join(',')})`;
                })
                .join(',');

            const queryItems = `
                INSERT INTO ${schema}.order_items (${columnsOrderItems.join(',')})
                VALUES ${placeholdersItems}
                RETURNING *
            `;

            const resultOrderItems = await client.query(queryItems, valuesOrderItems);
            await client.query('COMMIT');
            return {
                resultOrders: resultOrders.rows[0],
                items: resultOrderItems.rows
            };
        }
    } finally {
        client.release();
    }
};

module.exports = createOrder;