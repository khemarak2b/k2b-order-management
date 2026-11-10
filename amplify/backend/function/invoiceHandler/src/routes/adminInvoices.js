const express = require("express");
const router = express.Router();
const invoiceController = require("../controllers/invoiceController");
const { authMiddleware } = require("/opt/nodejs/middleware/authMiddleware");
const { requireAdmin } = require("/opt/nodejs/middleware/roleAuthorizationMiddleware");

// Apply auth and admin role check to all routes
router.use(authMiddleware);
router.use(requireAdmin);

// Admin invoice routes
router.get("/", invoiceController.getAllInvoices);
router.get("/:id", invoiceController.getInvoice);
router.get("/user/:userId/invoices", invoiceController.getUserInvoices);
router.get("/order/:orderId", invoiceController.getInvoiceByOrder);

// Admin actions
router.post("/order/:orderId/generate", invoiceController.generateInvoiceFromOrder);
router.get("/:id/pdf-download-url", invoiceController.getInvoicePDFDownloadUrl);
router.get("/order/:orderId/pdf-download-url", invoiceController.getInvoicePDFDownloadUrlByOrder);
router.put("/:id", invoiceController.updateInvoice);
router.delete("/:id", invoiceController.deleteInvoice);
// router.put("/:id/resend", invoiceController.sendInvoice); // TODO: Not yet implemented
// Record payment against invoice - inserts to invoice_payments table, syncs to order's payments table
router.post("/:id/payments", invoiceController.recordPayment);
router.get("/:id/payments", invoiceController.getInvoicePayments);
router.put("/:id/status", invoiceController.updateInvoiceStatus);

// Bulk operations
// router.post("/bulk/generate", invoiceController.generateBulkInvoices); // TODO: Not yet implemented

module.exports = router;
