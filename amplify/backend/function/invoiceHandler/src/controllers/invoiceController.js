const invoiceDb = require("../db/invoices");
const { formatResponse } = require("/opt/nodejs/utils/responseFormatter");
const { toSnakeCase } = require("/opt/nodejs/utils/caseConverter");
const { generateInvoicePDF } = require("../utils/pdfGenerator");
const { uploadInvoicePDF, getInvoicePDFPresignedUrl } = require("../utils/s3Storage");
const getInvoiceChangeLog = require("../db/invoices/read/getInvoiceChangeLog");

const normalizeVariantTitle = (value) => {
  if (typeof value !== "string") {
    return value || null;
  }

  const trimmedValue = value.trim();
  return trimmedValue && trimmedValue !== "Default Title" ? trimmedValue : null;
};

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

    const visibleInvoices = (invoices || []).filter((invoice) => isInvoiceVisibleToCustomer(invoice));

    res.json(formatResponse(visibleInvoices));
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

    if (!invoice || shouldHideInvoiceFromRequester(req, invoice)) {
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

    if (!invoice || shouldHideInvoiceFromRequester(req, invoice)) {
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
    const lineItems = order.items
      .filter((item) => Number(item.quantity) > 0)
      .map((item) => {
      const itemTotalExclusive = item.line_total / EXTRACTION_DIVISOR;
      const itemGst = item.line_total - itemTotalExclusive;

      return {
        order_item_id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.product_sku || null,
        variant_id: item.variant_id,
        variant_name: normalizeVariantTitle(item.variant_title),
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

    // Preserve manually-added line items (additional charges) when regenerating
    const existingManualLineItems = existingInvoice?.line_items
      ? existingInvoice.line_items.filter((item) => {
          const metadata = item.metadata || {};
          return metadata.type === "additional_charge" || metadata.is_manual === true;
        })
      : [];

    const normalizedManualLineItems = existingManualLineItems.map((item) => ({
      order_item_id: item.order_item_id || null,
      product_id: item.product_id || null,
      product_name: item.product_name,
      product_sku: item.product_sku || null,
      variant_id: item.variant_id || null,
      variant_name: normalizeVariantTitle(item.variant_name),
      quantity: item.quantity,
      unit_price: parseFloat(item.unit_price) || 0,
      line_total: parseFloat(item.line_total) || 0,
      gst_amount: parseFloat(item.gst_amount) || 0,
      gst_included: item.gst_included ?? true,
      discount_percent: item.discount_percent || null,
      discount_amount: parseFloat(item.discount_amount) || 0,
      description: item.description || null,
      notes: item.notes || null,
      metadata: item.metadata || { type: "additional_charge", is_manual: true },
    }));

    const allLineItems = [...lineItems, ...normalizedManualLineItems];

    const additionalSubtotalExclusive = normalizedManualLineItems.reduce((sum, item) => {
      const lineTotal = parseFloat(item.line_total) || 0;
      const isGstIncluded = item.gst_included !== false;
      return sum + (isGstIncluded ? lineTotal / EXTRACTION_DIVISOR : lineTotal);
    }, 0);

    const additionalGstAmount = normalizedManualLineItems.reduce((sum, item) => {
      if (item.gst_amount !== null && item.gst_amount !== undefined) {
        return sum + (parseFloat(item.gst_amount) || 0);
      }
      const lineTotal = parseFloat(item.line_total) || 0;
      const isGstIncluded = item.gst_included !== false;
      return sum + (isGstIncluded ? lineTotal - lineTotal / EXTRACTION_DIVISOR : lineTotal * GST_RATE);
    }, 0);

    const additionalTotal = normalizedManualLineItems.reduce((sum, item) => sum + (parseFloat(item.line_total) || 0), 0);
    const quantityAdjustments = await getInvoiceChangeLog(req.pool, orderId, process.env.ENVIRONMENT || "dev");

    // Create or reuse invoice
    let createdInvoice;
    let result;
    
    if (existingInvoice) {
      console.log("[generateInvoiceFromOrder] Regenerating invoice for order:", orderId);
      const existingAmountPaid = parseFloat(existingInvoice.amount_paid) || 0;
      const recalculatedTotalAmount = parseFloat((parseFloat(order.total_amount) + additionalTotal).toFixed(2));
      const recalculatedAmountDue = Math.max(0, parseFloat((recalculatedTotalAmount - existingAmountPaid).toFixed(2)));

      // Update existing invoice with new data
      createdInvoice = await invoiceDb.updateInvoice(req.pool, {
        id: existingInvoice.id,
        subtotal: parseFloat((invoiceData.subtotal + additionalSubtotalExclusive).toFixed(2)),
        gst_amount: parseFloat((invoiceData.gst_amount + additionalGstAmount).toFixed(2)),
        discount_amount: invoiceData.discount_amount,
        other_charges: invoiceData.other_charges,
        total_amount: recalculatedTotalAmount,
        amount_due: recalculatedAmountDue,
        notes: invoiceData.notes,
        updated_at: new Date().toISOString(),
      });
      // Update line items
      const updatedLineItems = await invoiceDb.updateInvoiceLineItems(req.pool, existingInvoice.id, allLineItems);
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
        quantityAdjustments,
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

const GST_RATE = 0.1;
const GST_EXTRACTION_DIVISOR = 1 + GST_RATE;

const roundMoney = (value) => parseFloat((Number(value) || 0).toFixed(2));

const normalizeAdditionalChargeLineItem = (item, index) => {
  const lineItemNumber = index + 1;
  const description = item.description || item.product_name || item.productName || item.name;
  const quantity = parseInt(item.quantity, 10);
  const unitPrice = parseFloat(item.unit_price ?? item.unitPrice);
  const gstIncluded = item.gst_included ?? item.gstIncluded ?? true;

  if (!description || typeof description !== "string") {
    throw new Error(`Invalid additional charge at index ${lineItemNumber}: description is required`);
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error(`Invalid additional charge at index ${lineItemNumber}: quantity must be a positive integer`);
  }

  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new Error(`Invalid additional charge at index ${lineItemNumber}: unitPrice must be a non-negative number`);
  }

  const lineTotal = roundMoney(quantity * unitPrice);
  const subtotalExclusive = gstIncluded ? roundMoney(lineTotal / GST_EXTRACTION_DIVISOR) : lineTotal;
  const gstAmount = gstIncluded ? roundMoney(lineTotal - subtotalExclusive) : roundMoney(lineTotal * GST_RATE);

  return {
    lineItem: {
      order_item_id: null,
      product_id: null,
      product_name: description,
      product_sku: null,
      variant_id: null,
      variant_name: null,
      quantity,
      unit_price: unitPrice,
      line_total: lineTotal,
      gst_amount: gstAmount,
      gst_included: !!gstIncluded,
      discount_percent: null,
      discount_amount: 0,
      description,
      notes: item.notes || null,
      metadata: {
        ...(item.metadata || {}),
        type: "additional_charge",
        is_manual: true,
      },
    },
    subtotalExclusive,
    gstAmount,
    lineTotal,
  };
};

const regenerateInvoicePdf = async (pool, invoiceId, updatedBy) => {
  const invoice = await invoiceDb.getInvoice(pool, invoiceId);
  if (!invoice || !invoice.invoice_number) {
    return;
  }

  const companyDetails = invoice.company_details || {
    name: process.env.COMPANY_NAME,
    abn: process.env.COMPANY_ABN,
    address: process.env.COMPANY_ADDRESS,
    email: process.env.COMPANY_EMAIL,
    phone: process.env.COMPANY_PHONE,
    website: process.env.COMPANY_WEBSITE,
  };

  const order = invoice.order_id ? await fetchOrderWithItems(pool, invoice.order_id) : null;

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
    console.warn("[regenerateInvoicePdf] Could not load logo:", error.message);
  }

  const pdfBuffer = await generateInvoicePDF(
    {
      ...invoice,
      orderNumber: order?.order_number,
    },
    invoice.line_items || [],
    invoice.quantity_adjustments || invoice.change_log || [],
    companyDetails,
    invoice.billing_address || order?.billing_address || {},
    invoice.shipping_address || order?.shipping_address || {},
    companyLogo,
  );

  const s3Upload = await uploadInvoicePDF(pdfBuffer, invoice.invoice_number);
  await invoiceDb.updateInvoice(pool, {
    id: invoiceId,
    pdf_url: s3Upload.url,
    pdf_generated_at: new Date().toISOString(),
    updated_by: updatedBy || null,
  });
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

    const existingInvoice = await invoiceDb.getInvoice(req.pool, id);
    if (!existingInvoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    const { lineItems, line_items, additionalLineItems, additional_line_items, ...invoicePayload } = req.body || {};

    const requestedAdditions = Array.isArray(additionalLineItems)
      ? additionalLineItems
      : Array.isArray(additional_line_items)
        ? additional_line_items
        : Array.isArray(lineItems)
          ? lineItems.filter((item) => !item?.id)
          : Array.isArray(line_items)
            ? line_items.filter((item) => !item?.id)
            : [];

    let recalculatedFields = {};

    if (requestedAdditions.length > 0) {
      const currentLineItems = Array.isArray(existingInvoice.line_items) ? existingInvoice.line_items : [];
      const lineItemsToAppend = [];

      let subtotalDelta = 0;
      let gstDelta = 0;
      let totalDelta = 0;

      requestedAdditions.forEach((item, index) => {
        const normalized = normalizeAdditionalChargeLineItem(item, index);
        lineItemsToAppend.push(normalized.lineItem);
        subtotalDelta += normalized.subtotalExclusive;
        gstDelta += normalized.gstAmount;
        totalDelta += normalized.lineTotal;
      });

      await invoiceDb.updateInvoiceLineItems(req.pool, id, [...currentLineItems, ...lineItemsToAppend]);

      recalculatedFields = {
        subtotal: roundMoney((parseFloat(existingInvoice.subtotal) || 0) + subtotalDelta),
        gst_amount: roundMoney((parseFloat(existingInvoice.gst_amount) || 0) + gstDelta),
        total_amount: roundMoney((parseFloat(existingInvoice.total_amount) || 0) + totalDelta),
        amount_due: roundMoney((parseFloat(existingInvoice.amount_due) || 0) + totalDelta),
      };
    }

    const dbData = toSnakeCase({ ...invoicePayload, ...recalculatedFields, id });
    await invoiceDb.updateInvoice(req.pool, dbData);

    if (requestedAdditions.length > 0) {
      try {
        await regenerateInvoicePdf(req.pool, id, req.user?.sub);
      } catch (pdfError) {
        console.warn("[updateInvoice] Failed to regenerate PDF after adding charges:", pdfError.message);
      }
    }

    const invoice = await invoiceDb.getInvoice(req.pool, id);

    res.json(formatResponse(invoice));
  } catch (error) {
    if (error.message?.includes("Invalid additional charge")) {
      return res.status(400).json({ error: error.message });
    }
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
    if (!invoice || shouldHideInvoiceFromRequester(req, invoice)) {
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
    if (!invoice || shouldHideInvoiceFromRequester(req, invoice)) {
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

    try {
      await regenerateInvoicePdf(req.pool, id, req.user?.sub);
    } catch (pdfError) {
      console.warn("[recordPayment] Failed to regenerate PDF after recording payment:", pdfError.message);
    }

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

    if (!invoice || shouldHideInvoiceFromRequester(req, invoice)) {
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

function shouldHideInvoiceFromRequester(req, invoice) {
  return req.isCustomerInvoiceRequest === true && !isInvoiceVisibleToCustomer(invoice);
}

function isInvoiceVisibleToCustomer(invoice) {
  return invoice?.status !== "draft";
}
