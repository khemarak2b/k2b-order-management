const createInvoice = async (pool, data) => {
  const client = await pool.connect();
  const schema = process.env.ENVIRONMENT || "dev";

  try {
    const {
      order_id,
      invoice_number,
      user_id,
      invoice_date,
      due_date,
      subtotal,
      gst_amount,
      discount_amount,
      other_charges,
      total_amount,
      amount_due,
      currency_code,
      status,
      payment_status,
      billing_address,
      shipping_address,
      po_number,
      payment_terms_days,
      payment_method,
      notes,
      terms_and_conditions,
      customer_details,
      company_details,
      metadata,
      line_items,
    } = data;

    console.log("[createInvoice] Creating invoice with data:", JSON.stringify(data));

    await client.query("BEGIN");

    // Insert invoice
    const invoiceQuery = `
      INSERT INTO ${schema}.invoices (
        order_id, invoice_number, user_id, invoice_date, due_date,
        subtotal, gst_amount, discount_amount, other_charges, total_amount,
        amount_due, currency_code, status, payment_status,
        billing_address, shipping_address, po_number, payment_terms_days,
        payment_method, notes, terms_and_conditions,
        customer_details, company_details, metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21,
        $22, $23, $24
      )
      RETURNING *
    `;

    const result = await client.query(invoiceQuery, [
      order_id,
      invoice_number,
      user_id,
      invoice_date,
      due_date,
      subtotal,
      gst_amount,
      discount_amount,
      other_charges || 0,
      total_amount,
      amount_due,
      currency_code || "AUD",
      status || "draft",
      payment_status || "unpaid",
      billing_address ? JSON.stringify(billing_address) : null,
      shipping_address ? JSON.stringify(shipping_address) : null,
      po_number || null,
      payment_terms_days || 30,
      payment_method || null,
      notes || null,
      terms_and_conditions || null,
      customer_details ? JSON.stringify(customer_details) : null,
      company_details ? JSON.stringify(company_details) : null,
      metadata ? JSON.stringify(metadata) : null,
    ]);

    const invoice = result.rows[0];

    // Insert line items if provided
    let lineItemsResult = [];
    if (line_items && line_items.length > 0) {
      for (const item of line_items) {
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
          invoice.id,
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

    return {
      invoice,
      line_items: lineItemsResult,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

module.exports = createInvoice;
