/**
 * Generate invoice HTML template
 */
const generateInvoiceHTML = (invoice, lineItems, companyDetails) => {
  const formatCurrency = (amount) => `$${parseFloat(amount).toFixed(2)}`;
  const formatDate = (date) => new Date(date).toLocaleDateString("en-AU");

  const lineItemsHTML = lineItems
    .map(
      (item) => `
    <tr>
      <td style="border-bottom: 1px solid #ddd; padding: 12px;">${item.product_name}</td>
      <td style="border-bottom: 1px solid #ddd; padding: 12px; text-align: center;">${item.quantity}</td>
      <td style="border-bottom: 1px solid #ddd; padding: 12px; text-align: right;">${formatCurrency(item.unit_price)}</td>
      <td style="border-bottom: 1px solid #ddd; padding: 12px; text-align: right;">${formatCurrency(item.line_total)}</td>
    </tr>
  `
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      color: #333;
      line-height: 1.6;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 40px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
      border-bottom: 2px solid #2c3e50;
      padding-bottom: 20px;
    }
    .company-info h1 {
      margin: 0;
      color: #2c3e50;
    }
    .company-info p {
      margin: 5px 0;
      font-size: 14px;
    }
    .invoice-details {
      text-align: right;
    }
    .invoice-details h2 {
      margin: 0 0 10px 0;
      color: #2c3e50;
      font-size: 24px;
    }
    .invoice-details p {
      margin: 5px 0;
      font-size: 14px;
    }
    .addresses {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
      gap: 40px;
    }
    .address-block h3 {
      margin-top: 0;
      color: #2c3e50;
      font-size: 12px;
      text-transform: uppercase;
    }
    .address-block p {
      margin: 5px 0;
      font-size: 14px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 30px 0;
    }
    table thead {
      background-color: #2c3e50;
      color: white;
    }
    table th {
      padding: 12px;
      text-align: left;
      font-weight: bold;
    }
    table td {
      padding: 12px;
    }
    .totals {
      display: flex;
      justify-content: flex-end;
      margin: 30px 0;
    }
    .totals-table {
      width: 300px;
    }
    .totals-table tr {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #ddd;
    }
    .totals-table tr.total {
      border-bottom: 2px solid #2c3e50;
      font-weight: bold;
      font-size: 16px;
      padding: 12px 0;
    }
    .notes {
      margin: 30px 0;
      padding: 15px;
      background-color: #f5f5f5;
      border-left: 4px solid #2c3e50;
    }
    .notes h3 {
      margin-top: 0;
      color: #2c3e50;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      font-size: 12px;
      color: #666;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="company-info">
        <h1>${companyDetails.name}</h1>
        <p><strong>ABN:</strong> ${companyDetails.abn}</p>
        <p>${companyDetails.address}</p>
        <p>📧 ${companyDetails.email}</p>
        <p>📞 ${companyDetails.phone}</p>
      </div>
      <div class="invoice-details">
        <h2>INVOICE</h2>
        <p><strong>Invoice #:</strong> ${invoice.invoice_number}</p>
        <p><strong>Date:</strong> ${formatDate(invoice.invoice_date)}</p>
        <p><strong>Due Date:</strong> ${formatDate(invoice.due_date)}</p>
        <p><strong>Order #:</strong> ${invoice.order_number || "-"}</p>
      </div>
    </div>

    <!-- Addresses -->
    <div class="addresses">
      <div class="address-block" style="flex: 1;">
        <h3>Bill To</h3>
        <p><strong>${invoice.customer_details?.name || "Customer"}</strong></p>
        ${
          invoice.billing_address
            ? `
          <p>${invoice.billing_address.street || ""}</p>
          <p>${invoice.billing_address.suburb || ""} ${invoice.billing_address.state || ""} ${invoice.billing_address.postcode || ""}</p>
        `
            : ""
        }
      </div>
      <div class="address-block" style="flex: 1;">
        <h3>Ship To</h3>
        <p><strong>${invoice.customer_details?.name || "Customer"}</strong></p>
        ${
          invoice.shipping_address
            ? `
          <p>${invoice.shipping_address.street || ""}</p>
          <p>${invoice.shipping_address.suburb || ""} ${invoice.shipping_address.state || ""} ${invoice.shipping_address.postcode || ""}</p>
        `
            : ""
        }
      </div>
    </div>

    <!-- Line Items Table -->
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align: center;">Qty</th>
          <th style="text-align: right;">Unit Price</th>
          <th style="text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemsHTML}
      </tbody>
    </table>

    <!-- Totals -->
    <div class="totals">
      <table class="totals-table">
        <tr>
          <td>Subtotal (excl. GST):</td>
          <td>${formatCurrency(invoice.subtotal)}</td>
        </tr>
        <tr>
          <td>GST (10%):</td>
          <td>${formatCurrency(invoice.gst_amount)}</td>
        </tr>
        ${invoice.discount_amount ? `<tr><td>Discount:</td><td>-${formatCurrency(invoice.discount_amount)}</td></tr>` : ""}
        ${invoice.other_charges ? `<tr><td>Shipping:</td><td>${formatCurrency(invoice.other_charges)}</td></tr>` : ""}
        <tr class="total">
          <td>Total (incl. GST):</td>
          <td>${formatCurrency(invoice.total_amount)}</td>
        </tr>
        <tr>
          <td>Amount Due:</td>
          <td>${formatCurrency(invoice.amount_due)}</td>
        </tr>
      </table>
    </div>

    <!-- Notes -->
    ${
      invoice.notes
        ? `
    <div class="notes">
      <h3>Notes</h3>
      <p>${invoice.notes}</p>
    </div>
    `
        : ""
    }

    <!-- Footer -->
    <div class="footer">
      <p>Thank you for your business! | Generated on ${new Date().toLocaleDateString("en-AU")}</p>
      <p>Website: ${companyDetails.website}</p>
    </div>
  </div>
</body>
</html>
  `;

  return html;
};

module.exports = { generateInvoiceHTML };
