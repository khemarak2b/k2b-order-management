/**
 * Admin API Routes
 * All endpoints require admin authentication
 * Admins can view/modify any user's orders
 */

const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const { adminAuthMiddleware } = require("/opt/nodejs/middleware/adminAuthMiddleware");
const {
  createRoleAwareOwnershipMiddleware,
  requireAdmin,
  requireUserIdMatchOrAdmin,
} = require("/opt/nodejs/middleware/roleAuthorizationMiddleware");
const orderDb = require("../db/orders");

// Bypass auth for quick testing (can be toggled in Lambda env vars without redeployment)
const BYPASS_AUTH = process.env.BYPASS_AUTH === "true";

// Middleware to conditionally skip auth
const authMiddleware = (req, res, next) => {
  if (BYPASS_AUTH) {
    console.warn("[AUTH BYPASS ENABLED] Skipping authentication checks");
    req.user = { sub: "test-user", isAdmin: true, adminId: 1, role: "SUPER_ADMIN" };
    return next();
  }
  adminAuthMiddleware(req, res, next);
};

const requireAdminMiddleware = (req, res, next) => {
  if (BYPASS_AUTH) {
    return next();
  }
  requireAdmin(req, res, next);
};

// Apply auth middleware to all routes
router.use(authMiddleware);
router.use(requireAdminMiddleware);

// Create reusable middleware for admin orders
const requireOrderOwnershipOrAdmin = createRoleAwareOwnershipMiddleware(async (req) =>
  orderDb.getOrder(req.pool, req.params.id),
);

const requirePaymentOrderOwnershipOrAdmin = createRoleAwareOwnershipMiddleware(async (req) =>
  orderDb.getOrder(req.pool, req.params.orderId),
);

const requireUserIdMatchOrAdminMiddleware = requireUserIdMatchOrAdmin((req) => req.params.userId);

// Orders endpoints - admin can access any user's orders
router.get("/", orderController.getAllOrders);
router.get("/order-number/:orderNumber", orderController.getOrderByOrderNumber);
router.get("/user/:userId", requireUserIdMatchOrAdminMiddleware, orderController.getOrders);
router.post("/", orderController.createOrder);
router.patch("/:orderId/items/:itemId", requirePaymentOrderOwnershipOrAdmin, orderController.updateOrderItemQuantity);
router.put("/:id", requireOrderOwnershipOrAdmin, orderController.updateOrder);
router.put("/:id/fulfill", requireOrderOwnershipOrAdmin, orderController.fulfillOrder);
router.delete("/:id", requireOrderOwnershipOrAdmin, orderController.deleteOrder);
router.get("/:id", requireOrderOwnershipOrAdmin, orderController.getOrder);

// Payments sub-resource endpoints - admin can access any payment
router.post("/:orderId/payments", requirePaymentOrderOwnershipOrAdmin, orderController.createPayment);
router.get("/:orderId/payments", requirePaymentOrderOwnershipOrAdmin, orderController.getPayments);
router.get("/:orderId/payments/:paymentId", requirePaymentOrderOwnershipOrAdmin, orderController.getPayment);
router.put("/:orderId/payments/:paymentId", requirePaymentOrderOwnershipOrAdmin, orderController.updatePayment);

module.exports = router;
