const express = require("express");
const router = express.Router();
const invoiceController = require("../controllers/invoiceController");
const { authMiddleware } = require("/opt/nodejs/middleware/authMiddleware");
const { requireAdmin } = require("/opt/nodejs/middleware/roleAuthorizationMiddleware");

// Bypass auth for quick testing
const BYPASS_AUTH = process.env.BYPASS_AUTH === "true";

const conditionalAuthMiddleware = (req, res, next) => {
  if (BYPASS_AUTH) {
    console.warn("[AUTH BYPASS ENABLED] Skipping authentication checks");
    req.user = { sub: "test-admin", userId: "test-admin-id", id: "test-admin-id", isAdmin: true };
    return next();
  }
  authMiddleware(req, res, next);
};

// Apply auth and admin role check to all routes
router.use(conditionalAuthMiddleware);
router.use(requireAdmin);

// Admin invoice routes
router.get("/", invoiceController.getAllInvoices);
router.get("/:id", invoiceController.getInvoice);
router.get("/user/:userId/invoices", invoiceController.getUserInvoices);
router.get("/order/:orderId", invoiceController.getInvoiceByOrder);

// Admin actions
router.post("/order/:orderId/generate", invoiceController.generateInvoiceFromOrder);
router.put("/:id", invoiceController.updateInvoice);
router.delete("/:id", invoiceController.deleteInvoice);
router.put("/:id/resend", invoiceController.sendInvoice);
router.post("/:id/payments", invoiceController.recordPayment);
router.put("/:id/status", invoiceController.updateInvoiceStatus);

// Bulk operations
router.post("/bulk/generate", invoiceController.generateBulkInvoices);

module.exports = router;
