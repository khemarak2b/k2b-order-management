const updateCart = async (pool, data) => {
    const client = await pool.connect();
    const schema = process.env.ENVIRONMENT || 'dev';

    try {
        await client.query('BEGIN');

        /* ---------- UPDATE CART ---------- */
        const { cart_id, ...cartFields } = data.cart;

        const cartColumns = Object.keys(cartFields);
        const cartValues = Object.values(cartFields);

        if (cartColumns.length > 0) {
            const setClause = cartColumns
                .map((col, i) => `${col} = $${i + 1}`)
                .join(', ');

            await client.query(
                `
                UPDATE ${schema}.carts
                SET ${setClause}
                WHERE cart_id = $${cartColumns.length + 1}
                `,
                [...cartValues, cart_id]
            );
        }

        /* ---------- EXISTING CART ITEMS ---------- */
        const existingRes = await client.query(
            `SELECT cart_item_id FROM ${schema}.cart_items WHERE cart_id = $1`,
            [cart_id]
        );

        const existingIds = existingRes.rows.map(r => r.cart_item_id);
        const incomingIds = data.cartItems
            .filter(i => i.cart_item_id)
            .map(i => i.cart_item_id);

        /* ---------- DELETE REMOVED ITEMS ---------- */
        const toDelete = existingIds.filter(id => !incomingIds.includes(id));
        if (toDelete.length > 0) {
            await client.query(
                `DELETE FROM ${schema}.cart_items WHERE cart_item_id = ANY($1)`,
                [toDelete]
            );
        }

        /* ---------- UPDATE / INSERT ITEMS ---------- */
        for (const item of data.cartItems) {
            if (item.cart_item_id) {
                // UPDATE
                const { cart_item_id, ...fields } = item;
                const cols = Object.keys(fields);
                const vals = Object.values(fields);

                const setClause = cols
                    .map((c, i) => `${c} = $${i + 1}`)
                    .join(', ');

                await client.query(
                    `
                    UPDATE ${schema}.cart_items
                    SET ${setClause}
                    WHERE cart_item_id = $${cols.length + 1}
                    `,
                    [...vals, cart_item_id]
                );
            } else {
                // INSERT
                const cols = Object.keys(item);
                const vals = Object.values(item);

                await client.query(
                    `
                    INSERT INTO ${schema}.cart_items (cart_id, ${cols.join(',')})
                    VALUES ($1, ${cols.map((_, i) => `$${i + 2}`).join(',')})
                    `,
                    [cart_id, ...vals]
                );
            }
        }

        await client.query('COMMIT');
        return { message: 'Cart updated successfully' };

    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

module.exports = updateCart;
