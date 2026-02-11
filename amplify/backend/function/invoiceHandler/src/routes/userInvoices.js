const express = require("express");
const router = express.Router();
const invoiceController = require("../controllers/invoiceController");
const { authMiddleware } = require("/opt/nodejs/middleware/authMiddleware");
const { createOwnershipMiddleware, requireUserIdMatch } = require("/opt/nodejs/middleware/authorizationMiddleware");
const invoiceDb = require("../db/invoices");

// Bypass auth for quick testing (can be toggled in Lambda env vars without redeployment)
const BYPASS_AUTH = process.env.BYPASS_AUTH === "true";

// Middleware to conditionally skip auth
const conditionalAuthMiddleware = (req, res, next) => {
  if (BYPASS_AUTH) {
    console.warn("[AUTH BYPASS ENABLED] Skipping authentication checks");
    req.user = { sub: "test-user", userId: "test-user-id" };
    return next();
  }
  authMiddleware(req, res, next);
};

// Apply auth middleware to all routes
router.use(conditionalAuthMiddleware);

// Middleware for invoice ownership
const requireInvoiceOwnership = createOwnershipMiddleware(
  async (req) => invoiceDb.getInvoice(req.pool, req.params.id)
);

const requireParamUserIdMatch = requireUserIdMatch((req) => req.params.userId);

// User invoice routes
router.get("/user/:userId", requireParamUserIdMatch, invoiceController.getUserInvoices);
router.get("/:id", requireInvoiceOwnership, invoiceController.getInvoice);
router.get("/order/:orderId", invoiceController.getInvoiceByOrder);
router.post("/order/:orderId/generate", invoiceController.generateInvoiceFromOrder);

// Invoice actions
router.put("/:id/send", requireInvoiceOwnership, invoiceController.sendInvoice);
router.put("/:id/mark-paid", requireInvoiceOwnership, invoiceController.markInvoiceAsPaid);

module.exports = router;
