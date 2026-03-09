const fs = require("fs");
const path = require("path");
const Handlebars = require("handlebars");

// Register custom helpers
Handlebars.registerHelper("formatCurrency", (amount) => {
  return parseFloat(amount).toFixed(2);
});

Handlebars.registerHelper("formatDate", (date) => {
  return new Date(date).toLocaleDateString("en-AU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
});

/**
 * Format currency to 2 decimal places
 */
const formatCurrency = (amount) => {
  return parseFloat(amount).toFixed(2);
};

/**
 * Format date for display
 */
const formatDate = (date) => {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-AU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

/**
 * Compile and render invoice HTML using Handlebars template
 */
const renderInvoiceHTML = (invoice, lineItems, companyDetails, billingAddress, shippingAddress, companyLogo) => {
  try {
    // Read the template file
    const templatePath = path.join(__dirname, "invoice.hbs");
    const templateContent = fs.readFileSync(templatePath, "utf-8");

    // Compile the template
    const template = Handlebars.compile(templateContent);

    // Format invoice data - handle both camelCase and snake_case field names
    const formattedInvoice = {
      ...invoice,
      invoiceNumber: invoice.invoice_number || invoice.invoiceNumber,
      invoiceDateFormatted: formatDate(invoice.invoice_date || invoice.invoiceDate || invoice.created_at),
      dueDateFormatted: formatDate(invoice.due_date || invoice.dueDate),
      orderNumber: invoice.order_number || invoice.orderNumber,
      subtotal: formatCurrency(invoice.subtotal || 0),
      gstAmount: formatCurrency(invoice.gst_amount || invoice.gstAmount || 0),
      discountAmount: formatCurrency(invoice.discount_amount || invoice.discountAmount || 0),
      otherCharges: formatCurrency(invoice.other_charges || invoice.otherCharges || 0),
      totalAmount: formatCurrency(invoice.total_amount || invoice.totalAmount || 0),
      amountDue: formatCurrency(invoice.amount_due || invoice.amountDue || 0),
      amountPaid: formatCurrency(invoice.amount_paid || invoice.amountPaid || 0),
    };

    const isAdditionalCharge = (item) => {
      const metadata = item.metadata || {};
      return metadata.type === "additional_charge" || metadata.is_manual === true;
    };

    // Format line items - handle both camelCase and snake_case field names
    const formattedLineItems = lineItems.map((item) => ({
      ...item,
      productName: item.product_name || item.productName,
      quantity: item.quantity || 0,
      unitPrice: formatCurrency(item.unit_price || item.unitPrice || 0),
      lineTotal: formatCurrency(item.line_total || item.lineTotal || 0),
    }));

    const productLineItems = formattedLineItems.filter((item) => !isAdditionalCharge(item));
    const additionalCharges = formattedLineItems.filter((item) => isAdditionalCharge(item));
    const additionalChargesTotal = formatCurrency(
      additionalCharges.reduce((sum, item) => sum + (parseFloat(item.line_total || item.lineTotal) || 0), 0),
    );

    // Prepare data for rendering
    const data = {
      invoice: formattedInvoice,
      lineItems: formattedLineItems,
      productLineItems,
      additionalCharges,
      additionalChargesTotal,
      companyDetails,
      billingAddress,
      shippingAddress,
      companyLogo,
      currentDate: new Date().toLocaleString("en-AU", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "longOffset",
        timeZone: "Australia/Sydney",
      }),
    };

    // Render the template
    const html = template(data);

    return html;
  } catch (error) {
    console.error("[renderInvoiceHTML] Error:", error.message);
    throw error;
  }
};

module.exports = { renderInvoiceHTML };
