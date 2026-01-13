const getOrder = async (pool, id) => {
     const client = await pool.connect();
     const schema = process.env.ENVIRONMENT || 'dev';
     
     try {
         // Get order         
         const orderResult = await client.query(
             `SELECT * FROM ${schema}.orders WHERE order_id = $1`,
             [id]
         );
         
         if (orderResult.rows.length === 0) {
             return null;
         }
         
         const order = orderResult.rows[0];         
         // Get variants with inventory and media
         const orderItemsResult = await client.query(
             `SELECT oi.order_item_id ,  oi.order_id , oi.product_id , oi.quantity, oi.unit_price, oi.total_price , oi.created_at
              FROM ${schema}.order_items oi
              WHERE oi.order_id = $1
              GROUP BY oi.order_item_id
              ORDER BY oi.order_item_id ASC`,
             [id]
         );          
         
         return {
             ...order,
             items: orderItemsResult.rows,   
         };         
     } finally {
         client.release();
     }
 };
 
 module.exports = getOrder;
