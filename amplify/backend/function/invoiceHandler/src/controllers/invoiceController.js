const invoiceDb = require("../db/invoices");
const { formatResponse } = require("/opt/nodejs/utils/responseFormatter");
const { toSnakeCase } = require("/opt/nodejs/utils/caseConverter");
const { generateInvoicePDF } = require("../utils/pdfGenerator");
const { uploadInvoicePDF, getInvoicePDFPresignedUrl } = require("../utils/s3Storage");

/**
 * Get all invoices (admin only)
 */
exports.getAllInvoices = async (req, res) => {
  try {
    const { status, payment_status, user_id, limit = 100, offset = 0 } = req.query;

    const invoices = await invoiceDb.getInvoices(req.pool, {
      status,
      payment_status,
      user_id,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json(formatResponse(invoices || []));
  } catch (error) {
    console.error("[getAllInvoices] Error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get user's invoices
 */
exports.getUserInvoices = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, payment_status, limit = 50, offset = 0 } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const invoices = await invoiceDb.getUserInvoices(req.pool, userId, {
      status,
      payment_status,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json(formatResponse(invoices || []));
  } catch (error) {
    console.error("[getUserInvoices] Error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get single invoice
 */
exports.getInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Invoice ID is required" });
    }

    const invoice = await invoiceDb.getInvoice(req.pool, id);

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    res.json(formatResponse(invoice));
  } catch (error) {
    console.error("[getInvoice] Error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get invoice by order ID
 */
exports.getInvoiceByOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ error: "Order ID is required" });
    }

    const invoice = await invoiceDb.getInvoiceByOrder(req.pool, orderId);

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found for this order" });
    }

    res.json(formatResponse(invoice));
  } catch (error) {
    console.error("[getInvoiceByOrder] Error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Generate invoice from order
 * Fetches order data and creates invoice with line items
 * Note: All prices are GST inclusive, so we extract the GST portion
 */
exports.generateInvoiceFromOrder = async (req, res) => {
  try {
    console.log("[generateInvoiceFromOrder] Request params:", JSON.stringify(req.params));

    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ error: "Order ID is required" });
    }

    // Get company details from environment variables
    const companyDetails = {
      name: process.env.COMPANY_NAME,
      abn: process.env.COMPANY_ABN,
      address: process.env.COMPANY_ADDRESS,
      email: process.env.COMPANY_EMAIL,
      phone: process.env.COMPANY_PHONE,
      website: process.env.COMPANY_WEBSITE,
    };

    // Fetch order and its items
    const order = await fetchOrderWithItems(req.pool, orderId);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Check if invoice already exists for this order
    const existingInvoice = await invoiceDb.getInvoiceByOrder(req.pool, orderId);

    // Extract GST from prices (GST inclusive model)
    // GST Rate = 10%, so to extract: gst = total / 11 (since total = base * 1.1)
    const GST_RATE = 0.1;
    const EXTRACTION_DIVISOR = 1 + GST_RATE; // 1.1

    // Calculate subtotal (GST exclusive) and GST amount
    const subtotalExclusive = order.total_amount / EXTRACTION_DIVISOR;
    const gstAmount = order.total_amount - subtotalExclusive;

    // Prepare line items from order items
    const lineItems = order.items.map((item) => {
      const itemTotalExclusive = item.line_total / EXTRACTION_DIVISOR;
      const itemGst = item.line_total - itemTotalExclusive;

      return {
        order_item_id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.product_sku || null,
        variant_id: item.variant_id,
        variant_name: item.variant_title,
        quantity: item.quantity,
        unit_price: item.price,
        line_total: item.line_total,
        gst_amount: itemGst,
        gst_included: true,
        description: null,
        notes: null,
        metadata: {
          original_order_item_id: item.id,
        },
      };
    });

    // Prepare invoice data
    // Note: invoice_number is auto-generated by database trigger
    const invoiceData = {
      order_id: orderId,
      user_id: order.user_id,
      invoice_date: new Date().toISOString().split("T")[0], // YYYY-MM-DD format
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 30 days from now
      subtotal: parseFloat(subtotalExclusive.toFixed(2)),
      gst_amount: parseFloat(gstAmount.toFixed(2)),
      discount_amount: order.discount_amount || 0,
      other_charges: order.shipping_cost || 0,
      total_amount: order.total_amount,
      amount_due: order.total_amount,
      currency_code: order.currency_code || "AUD",
      status: "draft",
      payment_status: "unpaid",
      billing_address: order.billing_address,
      shipping_address: order.shipping_address,
      po_number: null,
      payment_terms_days: 30,
      payment_method: null,
      notes: order.notes || null,
      terms_and_conditions: null,
      customer_details: {
        user_id: order.user_id,
        order_number: order.order_number,
      },
      company_details: companyDetails || null,
      created_by: req.user?.sub,
      metadata: {
        order_id: orderId,
        generated_at: new Date().toISOString(),
      },
      line_items: lineItems,
    };

    // Create or reuse invoice
    let createdInvoice;
    let result;
    
    if (existingInvoice) {
      console.log("[generateInvoiceFromOrder] Regenerating invoice for order:", orderId);
      // Update existing invoice with new data
      createdInvoice = await invoiceDb.updateInvoice(req.pool, {
        id: existingInvoice.id,
        subtotal: invoiceData.subtotal,
        gst_amount: invoiceData.gst_amount,
        discount_amount: invoiceData.discount_amount,
        other_charges: invoiceData.other_charges,
        total_amount: invoiceData.total_amount,
        amount_due: invoiceData.total_amount,
        notes: invoiceData.notes,
        updated_at: new Date().toISOString(),
      });
      // Update line items
      const updatedLineItems = await invoiceDb.updateInvoiceLineItems(req.pool, existingInvoice.id, lineItems);
      result = { invoice: createdInvoice, line_items: updatedLineItems };
    } else {
      console.log("[generateInvoiceFromOrder] Creating new invoice for order:", orderId);
      // Create new invoice
      result = await invoiceDb.createInvoice(req.pool, invoiceData);
      createdInvoice = result.invoice;
    }

    // Generate PDF and upload to S3
    try {
      console.log("[generateInvoiceFromOrder] Generating PDF for invoice:", createdInvoice.id);

      // Read logo if available
      let companyLogo = null;
      try {
        const fs = require("fs");
        const path = require("path");
        const logoPath = path.join(__dirname, "../templates/invoice-logo.png");
        if (fs.existsSync(logoPath)) {
          const logoBuffer = fs.readFileSync(logoPath);
          companyLogo = `data:image/png;base64,${logoBuffer.toString("base64")}`;
        }
      } catch (error) {
        console.warn("[generateInvoiceFromOrder] Could not load logo:", error.message);
      }

      const pdfBuffer = await generateInvoicePDF(
        {
          ...createdInvoice,
          orderNumber: order.order_number,
        },
        result.line_items,
        companyDetails,
        createdInvoice.billing_address || order.billing_address,
        createdInvoice.shipping_address || order.shipping_address,
        companyLogo,
      );

      const s3Upload = await uploadInvoicePDF(pdfBuffer, createdInvoice.invoice_number);

      // Update invoice with PDF URL and generation timestamp
      const updatedInvoiceData = await invoiceDb.updateInvoice(req.pool, {
        id: createdInvoice.id,
        pdf_url: s3Upload.url,
        pdf_generated_at: new Date().toISOString(),
        updated_by: req.user?.sub,
      });

      console.log("[generateInvoiceFromOrder] PDF generated and uploaded successfully");

      // Return updated invoice with PDF URL
      res.status(201).json(
        formatResponse({
          invoice: updatedInvoiceData,
          line_items: result.line_items,
        }),
      );
    } catch (pdfError) {
      console.error(
        "[generateInvoiceFromOrder] Warning: PDF generation failed, but invoice was created:",
        pdfError.message,
      );
      // Return original invoice without PDF URL
      res.status(201).json(formatResponse(result));
    }
  } catch (error) {
    console.error("[generateInvoiceFromOrder] Error:", error.message, error.stack);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Helper: Fetch order with items
 */
const fetchOrderWithItems = async (pool, orderId) => {
  const client = await pool.connect();
  const schema = process.env.ENVIRONMENT || "dev";

  try {
    // Get order
    const orderResult = await client.query(`SELECT * FROM ${schema}.orders WHERE id = $1`, [orderId]);

    if (orderResult.rows.length === 0) {
      return null;
    }

    const order = orderResult.rows[0];

    // Get order items
    const itemsResult = await client.query(`SELECT * FROM ${schema}.order_items WHERE order_id = $1 ORDER BY id ASC`, [
      orderId,
    ]);

    return {
      ...order,
      items: itemsResult.rows,
    };
  } finally {
    client.release();
  }
};

/**
 * Update invoice
 */
exports.updateInvoice = async (req, res) => {
  try {
    console.log("[updateInvoice] Request body:", JSON.stringify(req.body));

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Invoice ID is required" });
    }

    const dbData = toSnakeCase({ ...req.body, id });
    const invoice = await invoiceDb.updateInvoice(req.pool, dbData);

    res.json(formatResponse(invoice));
  } catch (error) {
    console.error("[updateInvoice] Error:", error.message, error.stack);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Update invoice status
 */
exports.updateInvoiceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Invoice ID is required" });
    }

    const validStatuses = ["draft", "issued", "sent", "partially_paid", "paid", "overdue", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const invoice = await invoiceDb.updateInvoice(req.pool, { id, status });

    res.json(formatResponse(invoice));
  } catch (error) {
    console.error("[updateInvoiceStatus] Error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Delete invoice (soft delete)
 */
exports.deleteInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Invoice ID is required" });
    }

    const invoice = await invoiceDb.getInvoice(req.pool, id);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    await invoiceDb.deleteInvoice(req.pool, id);
    res.status(204).send();
  } catch (error) {
    console.error("[deleteInvoice] Error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Send invoice to customer email
 */
exports.sendInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Invoice ID is required" });
    }

    // TODO: Implement email sending
    // 1. Get invoice
    // 2. Generate PDF if not already generated
    // 3. Send email with PDF attachment
    // 4. Update sent_at, sent_count

    res.status(501).json({ error: "Not yet implemented" });
  } catch (error) {
    console.error("[sendInvoice] Error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get invoice payment history
 */
exports.getInvoicePayments = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    if (!id) {
      return res.status(400).json({ error: "Invoice ID is required" });
    }

    // Verify invoice exists
    const invoice = await invoiceDb.getInvoice(req.pool, id);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    // Get payment history
    const payments = await invoiceDb.getInvoicePayments(req.pool, id, {
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json(formatResponse(payments || []));
  } catch (error) {
    console.error("[getInvoicePayments] Error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Record payment against invoice
 */
exports.recordPayment = async (req, res) => {
  try {
    console.log("[recordPayment] Request body:", JSON.stringify(req.body));

    const { id } = req.params;
    const { amount, payment_method, payment_reference, payment_date, notes } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Invoice ID is required" });
    }

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: "Amount must be a positive number" });
    }

    const result = await invoiceDb.recordPayment(req.pool, id, {
      amount: parseFloat(amount) || 0,
      payment_method: payment_method || null,
      payment_reference: payment_reference || null,
      payment_date: payment_date || new Date().toISOString().split("T")[0],
      notes: notes || null,
      recorded_by: req.user?.sub,
    });

    res.json(formatResponse(result));
  } catch (error) {
    console.error("[recordPayment] Error:", error.message, error.stack);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Generate invoices in bulk
 */
exports.generateBulkInvoices = async (req, res) => {
  try {
    const { orderIds } = req.body;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ error: "Order IDs array is required" });
    }

    // TODO: Implement bulk generation
    // Process multiple orders in parallel

    res.status(501).json({ error: "Not yet implemented" });
  } catch (error) {
    console.error("[generateBulkInvoices] Error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Mark invoice as paid
 */
exports.markInvoiceAsPaid = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Invoice ID is required" });
    }

    const invoice = await invoiceDb.getInvoice(req.pool, id);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    const updatedInvoice = await invoiceDb.updateInvoice(req.pool, {
      id,
      payment_status: "paid",
      status: "paid",
      paid_at: new Date().toISOString(),
    });

    res.json(formatResponse(updatedInvoice));
  } catch (error) {
    console.error("[markInvoiceAsPaid] Error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get presigned URL for invoice PDF download by invoice ID
 */
exports.getInvoicePDFDownloadUrl = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Invoice ID is required" });
    }

    const invoice = await invoiceDb.getInvoice(req.pool, id);

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    if (!invoice.invoice_number) {
      return res.status(400).json({ error: "Invoice PDF not yet generated" });
    }

    const bucketName = process.env.INVOICE_BUCKET_NAME;
    const presignedUrl = await getInvoicePDFPresignedUrl(bucketName, invoice.invoice_number, 3600);

    res.json(
      formatResponse({
        pdf_url: presignedUrl,
        invoice_number: invoice.invoice_number,
        expires_in: 3600,
      }),
    );
  } catch (error) {
    console.error("[getInvoicePDFDownloadUrl] Error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get presigned URL for invoice PDF download by order ID
 */
exports.getInvoicePDFDownloadUrlByOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ error: "Order ID is required" });
    }

    const invoice = await invoiceDb.getInvoiceByOrder(req.pool, orderId);

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found for this order" });
    }

    if (!invoice.invoice_number) {
      return res.status(400).json({ error: "Invoice PDF not yet generated" });
    }

    const bucketName = process.env.INVOICE_BUCKET_NAME;
    const presignedUrl = await getInvoicePDFPresignedUrl(bucketName, invoice.invoice_number, 3600);

    res.json(
      formatResponse({
        pdf_url: presignedUrl,
        invoice_number: invoice.invoice_number,
        expires_in: 3600,
      }),
    );
  } catch (error) {
    console.error("[getInvoicePDFDownloadUrlByOrder] Error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
