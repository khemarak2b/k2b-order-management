const enrichInvoiceDetails = require("./enrichInvoiceDetails");
const getInvoiceChangeLog = require("./getInvoiceChangeLog");

const getInvoiceByOrder = async (pool, orderId) => {
  const client = await pool.connect();
  const schema = process.env.ENVIRONMENT || "dev";

  try {
    const result = await client.query(
      `SELECT * FROM ${schema}.invoices WHERE order_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [orderId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const invoice = result.rows[0];

    // Parse JSONB fields
    if (invoice.billing_address && typeof invoice.billing_address === "string") {
      invoice.billing_address = JSON.parse(invoice.billing_address);
    }
    if (invoice.shipping_address && typeof invoice.shipping_address === "string") {
      invoice.shipping_address = JSON.parse(invoice.shipping_address);
    }
    if (invoice.customer_details && typeof invoice.customer_details === "string") {
      invoice.customer_details = JSON.parse(invoice.customer_details);
    }
    if (invoice.company_details && typeof invoice.company_details === "string") {
      invoice.company_details = JSON.parse(invoice.company_details);
    }
    if (invoice.metadata && typeof invoice.metadata === "string") {
      invoice.metadata = JSON.parse(invoice.metadata);
    }

    // Get line items
    const lineItemsResult = await client.query(
      `SELECT * FROM ${schema}.invoice_line_items WHERE invoice_id = $1 ORDER BY id ASC`,
      [invoice.id]
    );

    // Parse line item metadata
    const lineItems = lineItemsResult.rows.map((item) => {
      if (item.metadata && typeof item.metadata === "string") {
        item.metadata = JSON.parse(item.metadata);
      }
      return item;
    });

    // Get payments
    const paymentsResult = await client.query(
      `SELECT * FROM ${schema}.invoice_payments WHERE invoice_id = $1 ORDER BY payment_date DESC`,
      [invoice.id]
    );

    const changeLog = await getInvoiceChangeLog(client, orderId, schema);

    return enrichInvoiceDetails({
      ...invoice,
      line_items: lineItems,
      payments: paymentsResult.rows,
      change_log: changeLog,
    });
  } finally {
    client.release();
  }
};

module.exports = getInvoiceByOrder;
