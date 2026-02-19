const updateInvoiceLineItems = async (pool, invoiceId, lineItems) => {
  const client = await pool.connect();
  const schema = process.env.ENVIRONMENT || "dev";

  try {
    await client.query("BEGIN");

    // Delete existing line items
    await client.query(
      `DELETE FROM ${schema}.invoice_line_items WHERE invoice_id = $1`,
      [invoiceId]
    );

    // Insert new line items
    const lineItemsResult = [];
    if (lineItems && lineItems.length > 0) {
      for (const item of lineItems) {
        const itemQuery = `
          INSERT INTO ${schema}.invoice_line_items (
            invoice_id, order_item_id, product_id, product_name, product_sku,
            variant_id, variant_name, quantity, unit_price, line_total,
            gst_amount, gst_included, discount_percent, discount_amount,
            description, notes, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          RETURNING *
        `;

        const itemResult = await client.query(itemQuery, [
          invoiceId,
          item.order_item_id || null,
          item.product_id || null,
          item.product_name,
          item.product_sku || null,
          item.variant_id || null,
          item.variant_name || null,
          item.quantity,
          item.unit_price,
          item.line_total,
          item.gst_amount || 0,
          item.gst_included || false,
          item.discount_percent || null,
          item.discount_amount || 0,
          item.description || null,
          item.notes || null,
          item.metadata ? JSON.stringify(item.metadata) : null,
        ]);

        lineItemsResult.push(itemResult.rows[0]);
      }
    }

    await client.query("COMMIT");

    return lineItemsResult;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

module.exports = updateInvoiceLineItems;
