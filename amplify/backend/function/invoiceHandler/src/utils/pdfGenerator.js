const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const { renderInvoiceHTML } = require("../templates/templateHelper");

/**
 * Generate invoice PDF from invoice data
 */
const generateInvoicePDF = async (
  invoice,
  lineItems,
  quantityAdjustments,
  companyDetails,
  billingAddress,
  shippingAddress,
  companyLogo,
) => {
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
    const html = renderInvoiceHTML(
      invoice,
      lineItems,
      quantityAdjustments,
      companyDetails,
      billingAddress,
      shippingAddress,
      companyLogo,
    );

    // Set content
    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    // Generate PDF with page numbering
    const footerTemplate = `
      <style>
        * { margin: 0; padding: 0; }
        body { font-size: 10px; font-family: Arial, sans-serif; }
        .footer { text-align: right; padding-right: 20px; color: #95a5a6; margin-left: 20px; }
      </style>
      <div class="footer">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>
    `;

    const headerTemplate = `
      <div class="header">
  
      </div>
    `;

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "20px",
        right: "20px",
        bottom: "30px",
        left: "20px",
      },
      headerTemplate: headerTemplate,
      footerTemplate: footerTemplate,
      displayHeaderFooter: true,
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
