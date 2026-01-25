/**
 * Admin API Routes
 * All endpoints require admin authentication
 * Admins can view/modify any user's orders
 */

const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const { adminAuthMiddleware } = require("/opt/nodejs/middleware/adminAuthMiddleware");
const { createRoleAwareOwnershipMiddleware, requireAdmin, requireUserIdMatchOrAdmin } = require("/opt/nodejs/middleware/roleAuthorizationMiddleware");
const orderDb = require("../db/orders");

// Apply admin auth middleware to all routes
router.use(adminAuthMiddleware);
router.use(requireAdmin);

// Create reusable middleware for admin orders
const requireOrderOwnershipOrAdmin = createRoleAwareOwnershipMiddleware(
  async (req) => orderDb.getOrder(req.pool, req.params.id)
);

const requirePaymentOrderOwnershipOrAdmin = createRoleAwareOwnershipMiddleware(
  async (req) => orderDb.getOrder(req.pool, req.params.orderId)
);

const requireUserIdMatchOrAdminMiddleware = requireUserIdMatchOrAdmin((req) => req.params.userId);

// Orders endpoints - admin can access any user's orders
router.get("/user/:userId", requireUserIdMatchOrAdminMiddleware, orderController.getOrders);
router.put("/:id", requireOrderOwnershipOrAdmin, orderController.updateOrder);
router.delete("/:id", requireOrderOwnershipOrAdmin, orderController.deleteOrder);
router.get("/:id", requireOrderOwnershipOrAdmin, orderController.getOrder);

// Payments sub-resource endpoints - admin can access any payment
router.post("/:orderId/payments", requirePaymentOrderOwnershipOrAdmin, orderController.createPayment);
router.get("/:orderId/payments", requirePaymentOrderOwnershipOrAdmin, orderController.getPayments);
router.get("/:orderId/payments/:paymentId", requirePaymentOrderOwnershipOrAdmin, orderController.getPayment);
router.put("/:orderId/payments/:paymentId", requirePaymentOrderOwnershipOrAdmin, orderController.updatePayment);

module.exports = router;
