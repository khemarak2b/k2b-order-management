const updateInvoice = async (pool, data) => {
  const client = await pool.connect();
  const schema = process.env.ENVIRONMENT || "dev";

  try {
    const { id, ...updateData } = data;

    if (!id) {
      throw new Error("Invoice ID is required");
    }

    // Build dynamic UPDATE query
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updateData)) {
      // Skip internal metadata fields
      if (["created_at", "id"].includes(key)) continue;

      updateFields.push(`${key} = $${paramCount}`);

      // Handle JSONB fields
      if (["billing_address", "shipping_address", "company_address"].includes(key)) {
        values.push(value ? JSON.stringify(value) : null);
      } else {
        values.push(value);
      }
      paramCount++;
    }

    values.push(id);

    if (updateFields.length === 0) {
      // If no fields to update, just return current invoice
      const result = await client.query(
        `SELECT * FROM ${schema}.invoices WHERE id = $1`,
        [id]
      );
      return result.rows[0];
    }

    const query = `
      UPDATE ${schema}.invoices
      SET ${updateFields.join(", ")}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await client.query(query, values);

    if (result.rows.length === 0) {
      throw new Error("Invoice not found");
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

    return invoice;
  } finally {
    client.release();
  }
};

module.exports = updateInvoice;
