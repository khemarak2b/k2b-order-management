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

    // Format invoice data
    const formattedInvoice = {
      ...invoice,
      invoiceDateFormatted: formatDate(invoice.invoiceDate || invoice.created_at),
      dueDateFormatted: formatDate(invoice.dueDate),
      subtotal: formatCurrency(invoice.subtotal),
      gstAmount: formatCurrency(invoice.gstAmount),
      discountAmount: formatCurrency(invoice.discountAmount),
      otherCharges: formatCurrency(invoice.otherCharges),
      totalAmount: formatCurrency(invoice.totalAmount),
      amountDue: formatCurrency(invoice.amountDue),
    };

    // Format line items
    const formattedLineItems = lineItems.map((item) => ({
      ...item,
      unitPrice: formatCurrency(item.unitPrice),
      lineTotal: formatCurrency(item.lineTotal),
    }));

    // Prepare data for rendering
    const data = {
      invoice: formattedInvoice,
      lineItems: formattedLineItems,
      companyDetails,
      billingAddress,
      shippingAddress,
      companyLogo,
      currentDate: new Date().toLocaleDateString("en-AU", {
        year: "numeric",
        month: "long",
        day: "numeric",
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
