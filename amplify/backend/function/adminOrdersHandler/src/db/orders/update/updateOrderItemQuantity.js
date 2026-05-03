const getOrder = require("../read/getOrder");

const EDITABLE_ORDER_STATUSES = new Set(["pending", "processing"]);
const GST_RATE = 0.1;
const GST_EXTRACTION_DIVISOR = 1 + GST_RATE;

const roundMoney = (value) => parseFloat((Number(value) || 0).toFixed(2));

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const parseJsonObject = (value) => {
  if (!value) {
    return {};
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }

  if (typeof value === "object") {
    return value;
  }

  return {};
};

const isManualInvoiceLineItem = (item) => {
  const metadata = parseJsonObject(item.metadata);
  return metadata.type === "additional_charge" || metadata.is_manual === true;
};

const buildBaseInvoiceLineItems = (orderItems) =>
  orderItems
    .filter((item) => Number(item.quantity) > 0)
    .map((item) => {
    const lineTotal = roundMoney(item.line_total);
    const subtotalExclusive = roundMoney(lineTotal / GST_EXTRACTION_DIVISOR);
    const gstAmount = roundMoney(lineTotal - subtotalExclusive);

    return {
      order_item_id: item.id,
      product_id: item.product_id,
      product_name: item.product_name,
      product_sku: item.product_sku || null,
      variant_id: item.variant_id,
      variant_name: item.variant_title || null,
      quantity: item.quantity,
      unit_price: roundMoney(item.price),
      line_total: lineTotal,
      gst_amount: gstAmount,
      gst_included: true,
      discount_percent: null,
      discount_amount: 0,
      description: null,
      notes: null,
      metadata: JSON.stringify({
        original_order_item_id: item.id,
      }),
    };
  });

const normalizeManualInvoiceLineItems = (items) =>
  items.map((item) => {
    const metadata = parseJsonObject(item.metadata);

    return {
      order_item_id: item.order_item_id || null,
      product_id: item.product_id || null,
      product_name: item.product_name,
      product_sku: item.product_sku || null,
      variant_id: item.variant_id || null,
      variant_name: item.variant_name || null,
      quantity: item.quantity,
      unit_price: roundMoney(item.unit_price),
      line_total: roundMoney(item.line_total),
      gst_amount: roundMoney(item.gst_amount),
      gst_included: item.gst_included !== false,
      discount_percent: item.discount_percent || null,
      discount_amount: roundMoney(item.discount_amount),
      description: item.description || null,
      notes: item.notes || null,
      metadata: JSON.stringify(metadata),
    };
  });

const syncInvoiceForOrder = async (client, schema, order, orderItems) => {
  const invoiceResult = await client.query(
    `SELECT * FROM ${schema}.invoices WHERE order_id = $1 AND deleted_at IS NULL LIMIT 1`,
    [order.id],
  );

  if (invoiceResult.rows.length === 0) {
    return;
  }

  const invoice = invoiceResult.rows[0];

  const existingLineItemsResult = await client.query(
    `SELECT * FROM ${schema}.invoice_line_items WHERE invoice_id = $1 ORDER BY id ASC`,
    [invoice.id],
  );

  const manualLineItems = normalizeManualInvoiceLineItems(
    existingLineItemsResult.rows.filter(isManualInvoiceLineItem),
  );

  const baseLineItems = buildBaseInvoiceLineItems(orderItems);
  const allLineItems = [...baseLineItems, ...manualLineItems];

  const baseSubtotalExclusive = roundMoney(roundMoney(order.total_amount) / GST_EXTRACTION_DIVISOR);
  const baseGstAmount = roundMoney(roundMoney(order.total_amount) - baseSubtotalExclusive);

  const additionalSubtotalExclusive = manualLineItems.reduce((sum, item) => {
    const lineTotal = roundMoney(item.line_total);
    const gstIncluded = item.gst_included !== false;
    return roundMoney(sum + (gstIncluded ? lineTotal / GST_EXTRACTION_DIVISOR : lineTotal));
  }, 0);

  const additionalGstAmount = manualLineItems.reduce((sum, item) => {
    if (item.gst_amount !== null && item.gst_amount !== undefined) {
      return roundMoney(sum + roundMoney(item.gst_amount));
    }

    const lineTotal = roundMoney(item.line_total);
    return roundMoney(
      sum + (item.gst_included !== false ? lineTotal - lineTotal / GST_EXTRACTION_DIVISOR : lineTotal * GST_RATE),
    );
  }, 0);

  const additionalTotal = manualLineItems.reduce((sum, item) => roundMoney(sum + roundMoney(item.line_total)), 0);
  const totalAmount = roundMoney(roundMoney(order.total_amount) + additionalTotal);
  const amountPaid = roundMoney(invoice.amount_paid);
  const amountDue = roundMoney(Math.max(0, totalAmount - amountPaid));

  await client.query(
    `
      UPDATE ${schema}.invoices
      SET
        subtotal = $1,
        gst_amount = $2,
        discount_amount = $3,
        other_charges = $4,
        total_amount = $5,
        amount_due = $6,
        notes = $7,
        updated_at = NOW()
      WHERE id = $8
    `,
    [
      roundMoney(baseSubtotalExclusive + additionalSubtotalExclusive),
      roundMoney(baseGstAmount + additionalGstAmount),
      roundMoney(order.discount_amount),
      roundMoney(order.shipping_cost),
      totalAmount,
      amountDue,
      order.notes || null,
      invoice.id,
    ],
  );

  await client.query(`DELETE FROM ${schema}.invoice_line_items WHERE invoice_id = $1`, [invoice.id]);

  for (const item of allLineItems) {
    await client.query(
      `
        INSERT INTO ${schema}.invoice_line_items (
          invoice_id, order_item_id, product_id, product_name, product_sku,
          variant_id, variant_name, quantity, unit_price, line_total,
          gst_amount, gst_included, discount_percent, discount_amount,
          description, notes, metadata
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14,
          $15, $16, $17
        )
      `,
      [
        invoice.id,
        item.order_item_id,
        item.product_id,
        item.product_name,
        item.product_sku,
        item.variant_id,
        item.variant_name,
        item.quantity,
        item.unit_price,
        item.line_total,
        item.gst_amount,
        item.gst_included,
        item.discount_percent,
        item.discount_amount,
        item.description,
        item.notes,
        item.metadata,
      ],
    );
  }
};

const insertAdminChangeLog = async (
  client,
  schema,
  { orderId, itemId, previousQuantity, quantity, reasonCode, reasonLabel, adminNote, updatedBy, item },
) => {
  await client.query(
    `
      INSERT INTO ${schema}.admin_change_log (
        entity_type,
        entity_id,
        parent_entity_type,
        parent_entity_id,
        change_type,
        field_name,
        before_value,
        after_value,
        reason_code,
        reason_label,
        admin_note,
        changed_by,
        changed_at,
        metadata
      ) VALUES (
        'order_item',
        $1,
        'order',
        $2,
        'quantity_updated',
        'quantity',
        $3::jsonb,
        $4::jsonb,
        $5,
        $6,
        $7,
        $8,
        NOW(),
        $9::jsonb
      )
    `,
    [
      itemId,
      orderId,
      JSON.stringify({ quantity: previousQuantity }),
      JSON.stringify({ quantity }),
      reasonCode,
      reasonLabel,
      adminNote,
      updatedBy || null,
      JSON.stringify({
        productName: item.product_name,
        variantTitle: item.variant_title,
        productId: item.product_id,
        variantId: item.variant_id,
        image: item.image,
      }),
    ],
  );
};

const updateOrderItemQuantity = async (pool, { orderId, itemId, quantity, reasonCode, reasonLabel, adminNote, updatedBy }) => {
  const client = await pool.connect();
  const schema = process.env.ENVIRONMENT || "dev";

  try {
    await client.query("BEGIN");

    const orderResult = await client.query(`SELECT * FROM ${schema}.orders WHERE id = $1 FOR UPDATE`, [orderId]);
    if (orderResult.rows.length === 0) {
      throw createHttpError(404, "Order not found");
    }

    const order = orderResult.rows[0];

    if (!EDITABLE_ORDER_STATUSES.has(order.status)) {
      throw createHttpError(400, "Order items can only be edited for pending or processing orders");
    }

    const itemResult = await client.query(
      `SELECT * FROM ${schema}.order_items WHERE id = $1 AND order_id = $2 FOR UPDATE`,
      [itemId, orderId],
    );

    if (itemResult.rows.length === 0) {
      throw createHttpError(404, "Order item not found for this order");
    }

    const item = itemResult.rows[0];
    const previousQuantity = Number(item.quantity);
    const updatedLineTotal = roundMoney(roundMoney(item.price) * quantity);

    await client.query(
      `
        UPDATE ${schema}.order_items
        SET quantity = $1, line_total = $2, updated_at = NOW()
        WHERE id = $3 AND order_id = $4
      `,
      [quantity, updatedLineTotal, itemId, orderId],
    );

    const orderItemsResult = await client.query(
      `SELECT * FROM ${schema}.order_items WHERE order_id = $1 ORDER BY id ASC`,
      [orderId],
    );

    const orderItems = orderItemsResult.rows;
    const subtotal = roundMoney(orderItems.reduce((sum, orderItem) => sum + roundMoney(orderItem.line_total), 0));
    const totalAmount = roundMoney(
      subtotal + roundMoney(order.tax_amount) + roundMoney(order.shipping_cost) - roundMoney(order.discount_amount),
    );

    await client.query(
      `
        UPDATE ${schema}.orders
        SET subtotal = $1, total_amount = $2, updated_at = NOW()
        WHERE id = $3
      `,
      [subtotal, totalAmount, orderId],
    );

    const updatedOrder = {
      ...order,
      subtotal,
      total_amount: totalAmount,
    };

    await insertAdminChangeLog(client, schema, {
      orderId,
      itemId,
      previousQuantity,
      quantity,
      reasonCode,
      reasonLabel,
      adminNote,
      updatedBy,
      item,
    });

    await syncInvoiceForOrder(client, schema, updatedOrder, orderItems);

    await client.query("COMMIT");

    return await getOrder(pool, orderId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

module.exports = updateOrderItemQuantity;
