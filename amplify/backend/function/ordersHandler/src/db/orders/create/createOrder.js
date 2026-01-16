const createOrder = async (pool, data) => {
    const client = await pool.connect();
    const schema = process.env.ENVIRONMENT || 'dev';

    try {
        const { order_items, ...orderData } = data;
        const orderColumns = Object.keys(orderData);
        const orderValues = Object.values(orderData);
        const placeholders = orderColumns.map((_, i) => `$${i + 1}`).join(', ');

        await client.query('BEGIN');

        // Insert order
        const queryOrders = `
            INSERT INTO ${schema}.orders (${orderColumns.join(', ')})
            VALUES (${placeholders})
            RETURNING *
        `;
        const resultOrders = await client.query(queryOrders, orderValues);
        const orderId = resultOrders.rows[0].id;

        // Insert order items if provided
        let orderItemsResult = [];
        if (order_items && order_items.length > 0) {
            const columnsOrderItems = Object.keys(order_items[0]);

            // Ensure order_id is included in the items
            if (!columnsOrderItems.includes('order_id')) {
                columnsOrderItems.unshift('order_id');
            }

            const valuesOrderItems = [];
            const placeholdersItems = order_items
                .map(item => {
                    const rowPlaceholders = columnsOrderItems.map(col => {
                        let value;
                        if (col === 'order_id') {
                            value = orderId;
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
            orderItemsResult = resultOrderItems.rows;
        }

        await client.query('COMMIT');
        return {
            order: resultOrders.rows[0],
            items: orderItemsResult
        };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

module.exports = createOrder;
