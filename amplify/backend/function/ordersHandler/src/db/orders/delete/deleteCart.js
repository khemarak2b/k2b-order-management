const deleteCart = async (pool, id) => {
    const client = await pool.connect();
    const schema = process.env.ENVIRONMENT || 'dev';
    
    try {

        const cartResult = await client.query(
             `SELECT * FROM ${schema}.carts WHERE user_id = $1`,
             [id]
         );
        const result_cart_items = await client.query(
            `DELETE FROM ${schema}.cart_items WHERE cart_id = $1`,
            [cartResult.cart_id]
        );
        const result_cart = await client.query(
            `DELETE FROM ${schema}.carts WHERE user_id = $1`,
            [id]
        );
        return result_cart.rowCount > 0;
    } finally {
        client.release();
    }
};

module.exports = deleteCart;
