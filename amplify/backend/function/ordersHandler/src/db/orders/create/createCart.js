const createCart = async (pool, data) => {
  const client = await pool.connect();
  const schema = process.env.ENVIRONMENT || "dev";

  try {
    const { user_id } = data.cart;

    if (!user_id) {
      throw new Error("user_id is required");
    }

    await client.query("BEGIN");

    /* ---------- CHECK IF CART EXISTS FOR USER ---------- */
    const existingCartResult = await client.query(
      `SELECT id FROM ${schema}.carts WHERE user_id = $1`,
      [user_id]
    );

    let cartId;
    let cart;

    if (existingCartResult.rows.length > 0) {
      // Cart exists, use existing cart
      cartId = existingCartResult.rows[0].id;
      const cartResult = await client.query(`SELECT * FROM ${schema}.carts WHERE id = $1`, [cartId]);
      cart = cartResult.rows[0];
    } else {
      // Create new cart
      const columnsCart = Object.keys(data.cart);
      const valuesCart = Object.values(data.cart);
      const placeholders = columnsCart.map((_, i) => `$${i + 1}`).join(", ");

      const queryCart = `
        INSERT INTO ${schema}.carts (${columnsCart.join(", ")})
        VALUES (${placeholders})
        RETURNING *
      `;
      const resultCarts = await client.query(queryCart, valuesCart);
      cart = resultCarts.rows[0];
      cartId = cart.id;
    }

    /* ---------- INSERT CART ITEMS ---------- */
    let items = [];
    if (data.cart_items && data.cart_items.length > 0) {
      const columnsCartItems = Object.keys(data.cart_items[0]);

      // Ensure cart_id is included in the items
      if (!columnsCartItems.includes("cart_id")) {
        columnsCartItems.unshift("cart_id");
      }

      const valuesCartItems = [];
      const placeholdersItems = data.cart_items
        .map((item) => {
          const rowPlaceholders = columnsCartItems.map((col) => {
            let value;
            if (col === "cart_id") {
              value = cartId;
            } else {
              value = item[col] === undefined ? null : item[col];
            }
            valuesCartItems.push(value);
            return `$${valuesCartItems.length}`;
          });
          return `(${rowPlaceholders.join(",")})`;
        })
        .join(",");

      const queryItems = `
        INSERT INTO ${schema}.cart_items (${columnsCartItems.join(",")})
        VALUES ${placeholdersItems}
        RETURNING *
      `;

      const resultItems = await client.query(queryItems, valuesCartItems);
      items = resultItems.rows;
    }

    await client.query("COMMIT");
    return {
      cart,
      items,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

module.exports = createCart;
