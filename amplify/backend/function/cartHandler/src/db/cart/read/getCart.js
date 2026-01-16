const getCart = async (pool, userId) => {
  const client = await pool.connect();
  const schema = process.env.ENVIRONMENT || "dev";

  try {
    // Get cart
    const cartResult = await client.query(
      `SELECT * FROM ${schema}.carts WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1`,
      [userId]
    );

    if (cartResult.rows.length === 0) {
      return null;
    }

    const cart = cartResult.rows[0];

    // Get cart items with product and variant snapshots
    const cartItemResult = await client.query(
      `SELECT 
                 id,
                 cart_id,
                 product_id,
                 variant_id,
                 product_name,
                 price,
                 variant_title,
                 selected_option,
                 image,
                 quantity,
                 currency_code,
                 minimum_order_quantity,
                 minimum_order_value,
                 total_inventory,
                 added_at,
                 updated_at
             FROM ${schema}.cart_items
             WHERE cart_id = $1
             ORDER BY added_at DESC`,
      [cart.id]
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
