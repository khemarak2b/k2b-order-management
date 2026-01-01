const updateOrder = async (pool, data) => {
    const client = await pool.connect();
    const schema = process.env.ENVIRONMENT || 'dev';

    try {
        await client.query('BEGIN');

        /* ---------- UPDATE ORDER ---------- */
        const { order_id, ...orderFields } = data.order;
        const orderColumns = Object.keys(orderFields);
        const orderValues = Object.values(orderFields);

        if (orderColumns.length > 0) {
            const setClause = orderColumns
                .map((col, i) => `${col} = $${i + 1}`)
                .join(', ');

            const updateOrderQuery = `
                UPDATE ${schema}.orders
                SET ${setClause}
                WHERE order_id = $${orderColumns.length + 1}
                RETURNING *
            `;

            await client.query(updateOrderQuery, [...orderValues, order_id]);
        }

        /* ---------- EXISTING ORDER ITEM IDS ---------- */
        const existingItemsRes = await client.query(
            `SELECT order_item_id FROM ${schema}.order_items WHERE order_id = $1`,
            [order_id]
        );
        const existingIds = existingItemsRes.rows.map(r => r.order_item_id);

        const incomingIds = data.orderItems
            .filter(i => i.order_item_id)
            .map(i => i.order_item_id);

        /* ---------- DELETE REMOVED ITEMS ---------- */
        const toDelete = existingIds.filter(id => !incomingIds.includes(id));
        if (toDelete.length > 0) {
            await client.query(
                `DELETE FROM ${schema}.order_items WHERE order_item_id = ANY($1)`,
                [toDelete]
            );
        }

        /* ---------- UPDATE / INSERT ITEMS ---------- */
        for (const item of data.orderItems) {
            if (item.order_item_id) {
                // UPDATE
                const { order_item_id, ...fields } = item;
                const cols = Object.keys(fields);
                const vals = Object.values(fields);

                const setClause = cols
                    .map((c, i) => `${c} = $${i + 1}`)
                    .join(', ');

                await client.query(
                    `
                    UPDATE ${schema}.order_items
                    SET ${setClause}
                    WHERE order_item_id = $${cols.length + 1}
                    `,
                    [...vals, order_item_id]
                );
            } else {
                // INSERT
                const cols = Object.keys(item);
                const vals = Object.values(item);

                await client.query(
                    `
                    INSERT INTO ${schema}.order_items (order_id, ${cols.join(',')})
                    VALUES ($1, ${cols.map((_, i) => `$${i + 2}`).join(',')})
                    `,
                    [order_id, ...vals]
                );
            }
        }

        await client.query('COMMIT');
        return { message: 'Order updated successfully' };

    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

module.exports = updateOrder;
