const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const { renderInvoiceHTML } = require("../templates/templateHelper");

/**
 * Generate invoice PDF from invoice data
 */
const generateInvoicePDF = async (invoice, lineItems, companyDetails, billingAddress, shippingAddress, companyLogo) => {
  let browser;

  try {
    console.log("[generateInvoicePDF] Starting PDF generation");

    // Launch browser with chromium for Lambda
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();

    // Generate HTML using Handlebars template
    const html = renderInvoiceHTML(invoice, lineItems, companyDetails, billingAddress, shippingAddress, companyLogo);

    // Set content
    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "20px",
        right: "20px",
        bottom: "20px",
        left: "20px",
      },
    });

    console.log("[generateInvoicePDF] PDF generated successfully, size:", pdfBuffer.length);

    return pdfBuffer;
  } catch (error) {
    console.error("[generateInvoicePDF] Error:", error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

module.exports = { generateInvoicePDF };
