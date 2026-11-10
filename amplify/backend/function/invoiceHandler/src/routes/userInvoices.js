const express = require("express");
const router = express.Router();
const invoiceController = require("../controllers/invoiceController");
const { authMiddleware } = require("/opt/nodejs/middleware/authMiddleware");
const { createOwnershipMiddleware, requireUserIdMatch } = require("/opt/nodejs/middleware/authorizationMiddleware");
const invoiceDb = require("../db/invoices");

// Apply auth middleware to all routes
router.use(authMiddleware);
router.use((req, res, next) => {
  req.isCustomerInvoiceRequest = true;
  next();
});

// Middleware for invoice ownership
const requireInvoiceOwnership = createOwnershipMiddleware(async (req) => invoiceDb.getInvoice(req.pool, req.params.id));
const requireInvoiceOrderOwnership = createOwnershipMiddleware(
  async (req) => invoiceDb.getInvoiceByOrder(req.pool, req.params.orderId),
);

const requireParamUserIdMatch = requireUserIdMatch((req) => req.params.userId);

// User invoice routes
router.get("/user/:userId", requireParamUserIdMatch, invoiceController.getUserInvoices);
router.get("/order/:orderId", requireInvoiceOrderOwnership, invoiceController.getInvoiceByOrder);
router.get("/order/:orderId/pdf-download-url", requireInvoiceOrderOwnership, invoiceController.getInvoicePDFDownloadUrlByOrder);
router.get("/:id/pdf-download-url", requireInvoiceOwnership, invoiceController.getInvoicePDFDownloadUrl);
router.get("/:id", requireInvoiceOwnership, invoiceController.getInvoice);

module.exports = router;
