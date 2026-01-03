const createCart = async (pool, data) => {
    const client = await pool.connect();
    const schema = process.env.ENVIRONMENT || 'dev';
    
    try {
        const columnsCart = Object.keys(data.cart);
        const valuesCart = Object.values(data.cart);
        const placeholders = columnsCart.map((_, i) => `$${i + 1}`).join(', ');
         await client.query('BEGIN');

        const queryCart = `
            INSERT INTO ${schema}.carts (${columnsCart.join(', ')})
            VALUES (${placeholders})
            RETURNING *
        `;        
        const resultCarts = await client.query(queryCart, valuesCart);
        const cartId = resultCarts.rows[0].cart_id; 

        // ---------- INSERT cart ITEMS ----------
        if (data.cart_items && data.cart_items.length > 0) {
            const columnsCartItems = Object.keys(data.cart_items[0]);

            // Ensure order_id is included in the items
            if (!columnsCartItems.includes('cart_id')) {
                columnsCartItems.unshift('cart_id'); // add at start
            }

            const valuesCartItems = [];
            const placeholdersItems = data.cart_items
                .map((item, rowIndex) => {
                    const rowPlaceholders = columnsCartItems.map((col, colIndex) => {
                        let value;
                        if (col === 'cart_id') {
                            value = cartId; // set parent order_id
                        } else {
                            value = item[col];
                        }
                        valuesCartItems.push(value);
                        return `$${rowIndex * valuesCartItems.length + colIndex + 1}`;
                    });
                    return `(${rowPlaceholders.join(',')})`;
                })
                .join(',');

            const queryItems = `
                INSERT INTO ${schema}.cart_items (${columnsCartItems.join(',')})
                VALUES ${placeholdersItems}
                RETURNING *
            `;

            const resultOrderItems = await client.query(queryItems, valuesCartItems);
            await client.query('COMMIT');
            return {
                resultOrders: resultCarts.rows[0],
                items: resultOrderItems.rows
            };
        }
    } finally {
        client.release();
    }
};

module.exports = createCart;



