const getOrder = require("../read/getOrder");

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

/**
 * Transitions an order from processing -> shipped, recording which
 * Shopify location(s) fulfilled each order item (a line item's quantity may
 * be split across multiple locations).
 */
const fulfillOrder = async (pool, { orderId, trackingNumber, trackingUrl, items }) => {
  const client = await pool.connect();
  const schema = process.env.ENVIRONMENT || "dev";

  try {
    await client.query("BEGIN");

    const orderResult = await client.query(`SELECT * FROM ${schema}.orders WHERE id = $1 FOR UPDATE`, [orderId]);
    if (orderResult.rows.length === 0) {
      throw createHttpError(404, "Order not found");
    }

    const order = orderResult.rows[0];

    if (order.status !== "processing") {
      throw createHttpError(400, `Cannot transition from ${order.status} to shipped`);
    }

    const orderItemsResult = await client.query(`SELECT * FROM ${schema}.order_items WHERE order_id = $1`, [
      orderId,
    ]);
    const orderItemsById = new Map(orderItemsResult.rows.map((item) => [item.id, item]));

    for (const item of items) {
      const orderItem = orderItemsById.get(Number(item.orderItemId));
      if (!orderItem) {
        throw createHttpError(400, `Order item ${item.orderItemId} does not belong to this order`);
      }

      const splitTotal = (item.splits || []).reduce((sum, split) => sum + Number(split.quantity), 0);
      if (splitTotal !== Number(orderItem.quantity)) {
        throw createHttpError(
          400,
          `Fulfillment split quantities for item ${item.orderItemId} (${splitTotal}) must equal ordered quantity (${orderItem.quantity})`,
        );
      }
    }

    const updateColumns = ["status = 'shipped'"];
    const values = [];

    if (trackingNumber !== undefined) {
      values.push(trackingNumber);
      updateColumns.push(`tracking_number = $${values.length}`);
    }
    if (trackingUrl !== undefined) {
      values.push(trackingUrl);
      updateColumns.push(`tracking_url = $${values.length}`);
    }

    values.push(orderId);
    await client.query(
      `UPDATE ${schema}.orders SET ${updateColumns.join(", ")}, updated_at = NOW() WHERE id = $${values.length}`,
      values,
    );

    for (const item of items) {
      for (const split of item.splits || []) {
        await client.query(
          `INSERT INTO ${schema}.order_item_fulfillments (order_item_id, shopify_location_id, location_name, quantity)
           VALUES ($1, $2, $3, $4)`,
          [item.orderItemId, split.shopifyLocationId, split.locationName || null, split.quantity],
        );
      }
    }

    await client.query("COMMIT");

    return await getOrder(pool, orderId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

module.exports = fulfillOrder;
