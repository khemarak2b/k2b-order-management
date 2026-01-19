const createOrder = async (pool, data) => {
  const client = await pool.connect();
  const schema = process.env.ENVIRONMENT || "dev";

  try {
    const { order_items, ...orderData } = data;
    const orderColumns = Object.keys(orderData);
    const orderValues = Object.values(orderData);
    const placeholders = orderColumns.map((_, i) => `$${i + 1}`).join(", ");

    await client.query("BEGIN");

    // Insert order
    const queryOrders = `
            INSERT INTO ${schema}.orders (${orderColumns.join(", ")})
            VALUES (${placeholders})
            RETURNING *
        `;
    const resultOrders = await client.query(queryOrders, orderValues);
    const orderId = resultOrders.rows[0].id;

    // Insert order items if provided
    let orderItemsResult = [];
    if (order_items && order_items.length > 0) {
      // Validate and enrich order items with current prices from database
      const enrichedItems = [];
      
      for (const item of order_items) {
        // Get current product variant price from database
        const priceQuery = `
          SELECT price FROM ${schema}.product_variants 
          WHERE id = $1
        `;
        const priceResult = await client.query(priceQuery, [item.variant_id]);
        
        if (priceResult.rows.length === 0) {
          throw new Error(`Product variant ${item.variant_id} not found`);
        }
        
        const currentPrice = parseFloat(priceResult.rows[0].price);
        const quantity = parseInt(item.quantity, 10);
        const lineTotal = currentPrice * quantity;
        
        // Use current price from database (not frontend price)
        enrichedItems.push({
          ...item,
          price: currentPrice,
          line_total: lineTotal,
        });
      }

      const columnsOrderItems = Object.keys(enrichedItems[0]);

      // Ensure order_id is included in the items
      if (!columnsOrderItems.includes("order_id")) {
        columnsOrderItems.unshift("order_id");
      }

      const valuesOrderItems = [];
      const placeholdersItems = enrichedItems
        .map((item) => {
          const rowPlaceholders = columnsOrderItems.map((col) => {
            let value;
            if (col === "order_id") {
              value = orderId;
            } else {
              value = item[col] === undefined ? null : item[col];
            }
            valuesOrderItems.push(value);
            return `$${valuesOrderItems.length}`;
          });
          return `(${rowPlaceholders.join(",")})`;
        })
        .join(",");

      const queryItems = `
                INSERT INTO ${schema}.order_items (${columnsOrderItems.join(",")})
                VALUES ${placeholdersItems}
                RETURNING *
            `;

      const resultOrderItems = await client.query(queryItems, valuesOrderItems);
      orderItemsResult = resultOrderItems.rows;
    }

    await client.query("COMMIT");
    return {
      order: resultOrders.rows[0],
      items: orderItemsResult,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

module.exports = createOrder;
