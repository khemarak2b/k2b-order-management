const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const { authMiddleware } = require("/opt/nodejs/middleware/authMiddleware");
const { createOwnershipMiddleware, requireUserIdMatch } = require("/opt/nodejs/middleware/authorizationMiddleware");
const orderDb = require("../db/orders");

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

// Create reusable middleware for orders
const requireOrderOwnership = createOwnershipMiddleware(
  async (req) => orderDb.getOrder(req.pool, req.params.id)
);

const requirePaymentOrderOwnership = createOwnershipMiddleware(
  async (req) => orderDb.getOrder(req.pool, req.params.orderId)
);

const requireBodyUserIdMatch = requireUserIdMatch((req) => req.body.userId);
const requireParamUserIdMatch = requireUserIdMatch((req) => req.params.userId);

// Orders endpoints
router.get("/user/:userId", requireParamUserIdMatch, orderController.getOrders);
router.post("/", requireBodyUserIdMatch, orderController.createOrder);
router.put("/:id", requireOrderOwnership, orderController.updateOrder);
router.delete("/:id", requireOrderOwnership, orderController.deleteOrder);
router.get("/:id", requireOrderOwnership, orderController.getOrder);

// Payments sub-resource endpoints
router.post("/:orderId/payments", requirePaymentOrderOwnership, orderController.createPayment);
router.get("/:orderId/payments", requirePaymentOrderOwnership, orderController.getPayments);
router.get("/:orderId/payments/:paymentId", requirePaymentOrderOwnership, orderController.getPayment);
router.put("/:orderId/payments/:paymentId", requirePaymentOrderOwnership, orderController.updatePayment);

module.exports = router;
