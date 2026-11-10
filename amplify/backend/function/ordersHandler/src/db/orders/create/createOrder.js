// Only these order_items columns may be written. Prices, totals and the product
// a variant belongs to always come from the database, never from the client.
const CLIENT_ITEM_FIELDS = ["product_name", "variant_title", "selected_option", "image"];

const badRequest = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const toMoney = (value) => Math.round(value * 100) / 100;

/**
 * Prices each requested item from product_variants and returns the rows to
 * insert plus the order subtotal.
 */
async function priceItems(client, schema, orderItems) {
  const items = [];
  let subtotal = 0;

  for (const item of orderItems) {
    const variantId = Number(item.variant_id ?? item.variantId);
    const quantity = Number(item.quantity);

    if (!Number.isInteger(variantId) || variantId <= 0) {
      throw badRequest("Each item needs a valid variantId");
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw badRequest("Each item needs a quantity of at least 1");
    }

    // Same rule as the Customer App shows at checkout: variant wholesale price,
    // then product wholesale price, then the variant price. Zero counts as unset.
    // Which price is authoritative is still open (D-24).
    const variantResult = await client.query(
      `SELECT pv.id, pv.product_id,
              COALESCE(NULLIF(pv.wholesale_price, 0), NULLIF(p.wholesale_price, 0), pv.price) AS price
         FROM ${schema}.product_variants pv
         JOIN ${schema}.products p ON p.id = pv.product_id
        WHERE pv.id = $1`,
      [variantId],
    );
    if (variantResult.rows.length === 0) {
      throw badRequest(`Product variant ${variantId} not found`);
    }

    const variant = variantResult.rows[0];
    const price = parseFloat(variant.price);
    const lineTotal = toMoney(price * quantity);
    subtotal += lineTotal;

    const row = {
      product_id: variant.product_id,
      variant_id: variant.id,
      price,
      quantity,
      line_total: lineTotal,
    };
    for (const field of CLIENT_ITEM_FIELDS) {
      if (item[field] !== undefined) {
        row[field] = item[field];
      }
    }
    if (row.selected_option !== undefined && row.selected_option !== null) {
      row.selected_option = JSON.stringify(row.selected_option);
    }
    items.push(row);
  }

  return { items, subtotal: toMoney(subtotal) };
}

const createOrder = async (pool, data) => {
  const { order_items, ...orderData } = data;
  if (!Array.isArray(order_items) || order_items.length === 0) {
    throw badRequest("An order needs at least one item");
  }

  const client = await pool.connect();
  const schema = process.env.ENVIRONMENT || "dev";

  try {
    await client.query("BEGIN");

    const { items, subtotal } = await priceItems(client, schema, order_items);
    const order = {
      ...orderData,
      subtotal,
      tax_amount: 0,
      shipping_cost: 0,
      discount_amount: 0,
      total_amount: subtotal,
    };

    const orderColumns = Object.keys(order);
    const placeholders = orderColumns.map((_, i) => `$${i + 1}`).join(", ");
    const resultOrders = await client.query(
      `INSERT INTO ${schema}.orders (${orderColumns.join(", ")})
       VALUES (${placeholders})
       RETURNING *`,
      Object.values(order),
    );
    const orderId = resultOrders.rows[0].id;

    const itemColumns = ["order_id", "product_id", "variant_id", "price", "quantity", "line_total", ...CLIENT_ITEM_FIELDS];
    const values = [];
    const rows = items.map((item) => {
      const rowPlaceholders = itemColumns.map((column) => {
        values.push(column === "order_id" ? orderId : item[column] ?? null);
        return `$${values.length}`;
      });
      return `(${rowPlaceholders.join(",")})`;
    });

    const resultOrderItems = await client.query(
      `INSERT INTO ${schema}.order_items (${itemColumns.join(",")})
       VALUES ${rows.join(",")}
       RETURNING *`,
      values,
    );

    await client.query("COMMIT");
    return {
      order: resultOrders.rows[0],
      items: resultOrderItems.rows,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

module.exports = createOrder;
module.exports.CLIENT_ITEM_FIELDS = CLIENT_ITEM_FIELDS;
