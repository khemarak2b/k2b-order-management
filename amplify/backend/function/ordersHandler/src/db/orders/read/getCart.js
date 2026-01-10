 const getCart = async (pool, id) => {
     const client = await pool.connect();
     const schema = process.env.ENVIRONMENT || 'dev';
     
     try {
         // Get order         
         const cartResult = await client.query(
             `SELECT * FROM ${schema}.carts WHERE status = 'ACTIVE' and user_id = $1`,
             [id]
         );
         
         if (cartResult.rows.length === 0) {
             return null;
         }
         
         const cart = cartResult.rows[0];         
         // Get variants with inventory and media
         const cartItemResult = await client.query(
             `SELECT ci.cart_item_id , ci.cart_id , ci.product_id , ci.quantity , ci.unit_price , ci.created_at , ci.updated_at 
              FROM ${schema}.cart_items ci
              WHERE ci.cart_id = $1
              GROUP BY ci.cart_item_id
              ORDER BY ci.cart_item_id ASC`,
             [cart.cart_id]
         );          
         
         return {
             ...cart,
             items: cartItemResult.rows,   
         };         
     } finally {
         client.release();
     }
 };
 
 module.exports = getCart;
