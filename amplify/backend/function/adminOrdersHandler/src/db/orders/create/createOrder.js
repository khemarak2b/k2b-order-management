const createOrder = async (pool, data) => {
  const client = await pool.connect();
  const schema = process.env.ENVIRONMENT || "dev";

  try {
    const {
      order_items,
      pricing_profile_id,
      tax_amount = 0,
      shipping_cost = 0,
      discount_amount = 0,
      ...orderSeed
    } = data;

    const normalizedTaxAmount = Number(tax_amount) || 0;
    const normalizedShippingCost = Number(shipping_cost) || 0;
    const normalizedDiscountAmount = Number(discount_amount) || 0;

    await client.query("BEGIN");

    const enrichedItems = [];

    for (const item of order_items || []) {
      const variantId = item.variant_id || item.variantId;

      if (!variantId) {
        throw new Error("Each order item must include a variant_id");
      }

      const variantQuery = `
        SELECT
          pv.id,
          pv.product_id,
          pv.title,
          pv.price AS base_price,
          pv.currency_code,
          pvp.override_price
        FROM ${schema}.product_variants pv
        LEFT JOIN ${schema}.pricing_profile_variant_prices pvp
          ON pvp.variant_id = pv.id
         AND pvp.profile_id = $2
        WHERE pv.id = $1
      `;
      const variantResult = await client.query(variantQuery, [variantId, pricing_profile_id || null]);

      if (variantResult.rows.length === 0) {
        throw new Error(`Product variant ${variantId} not found`);
      }

      const variant = variantResult.rows[0];
      const resolvedPrice =
        variant.override_price !== null && variant.override_price !== undefined
          ? Number(variant.override_price)
          : Number(variant.base_price);
      const quantity = Number(item.quantity);

      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error(`Invalid quantity for variant ${variantId}`);
      }

      enrichedItems.push({
        order_id: null,
        product_id: item.product_id || item.productId || variant.product_id,
        variant_id: variant.id,
        product_name: item.product_name || item.productName,
        variant_title: item.variant_title || item.variantTitle || variant.title,
        image: item.image || null,
        selected_option: item.selected_option || item.selectedOption || null,
        quantity,
        price: resolvedPrice,
        currency_code:
          item.currency_code || item.currencyCode || variant.currency_code || orderSeed.currency_code || "AUD",
        line_total: resolvedPrice * quantity,
      });
    }

    const subtotal = enrichedItems.reduce((sum, item) => sum + Number(item.line_total), 0);
    const totalAmount = subtotal + normalizedTaxAmount + normalizedShippingCost - normalizedDiscountAmount;

    const orderData = {
      ...orderSeed,
      subtotal,
      tax_amount: normalizedTaxAmount,
      shipping_cost: normalizedShippingCost,
      discount_amount: normalizedDiscountAmount,
      total_amount: totalAmount,
    };

    const orderColumns = Object.keys(orderData);
    const orderValues = Object.values(orderData);
    const orderPlaceholders = orderColumns.map((_, index) => `$${index + 1}`).join(", ");

    const orderInsertResult = await client.query(
      `
        INSERT INTO ${schema}.orders (${orderColumns.join(", ")})
        VALUES (${orderPlaceholders})
        RETURNING *
      `,
      orderValues,
    );

    const order = orderInsertResult.rows[0];
    const orderId = order.id;

    let insertedItems = [];
    if (enrichedItems.length > 0) {
      const itemColumns = Object.keys(enrichedItems[0]);
      const itemValues = [];
      const itemPlaceholders = enrichedItems
        .map((item) => {
          const rowPlaceholders = itemColumns.map((column) => {
            const value = column === "order_id" ? orderId : item[column];
            itemValues.push(value);
            return `$${itemValues.length}`;
          });

          return `(${rowPlaceholders.join(", ")})`;
        })
        .join(", ");

      const itemInsertResult = await client.query(
        `
          INSERT INTO ${schema}.order_items (${itemColumns.join(", ")})
          VALUES ${itemPlaceholders}
          RETURNING *
        `,
        itemValues,
      );

      insertedItems = itemInsertResult.rows;
    }

    await client.query("COMMIT");
    return {
      order,
      items: insertedItems,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

module.exports = createOrder;
