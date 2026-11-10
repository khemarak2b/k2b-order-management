const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const { authMiddleware } = require("/opt/nodejs/middleware/authMiddleware");
const { createOwnershipMiddleware, requireUserIdMatch } = require("/opt/nodejs/middleware/authorizationMiddleware");
const orderDb = require("../db/orders");

// Apply auth middleware to all routes
router.use(authMiddleware);

// Create reusable middleware for orders
const requireOrderOwnership = createOwnershipMiddleware(
  async (req) => orderDb.getOrder(req.pool, req.params.id)
);

const requireOrderNumberOwnership = createOwnershipMiddleware(
  async (req) => orderDb.getOrderByNumber(req.pool, req.params.orderNumber)
);

const requirePaymentOrderOwnership = createOwnershipMiddleware(
  async (req) => orderDb.getOrder(req.pool, req.params.orderId)
);

const requireBodyUserIdMatch = requireUserIdMatch((req) => req.body.userId);
const requireParamUserIdMatch = requireUserIdMatch((req) => req.params.userId);

/**
 * The only change a customer may make to their own order is cancelling it
 * while it is still pending. Any other status change, or any other field,
 * belongs to an admin through adminOrdersHandler.
 */
const allowCustomerCancelOnly = (req, res, next) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const otherFields = Object.keys(body).filter((key) => key !== "status");

  if (body.status !== "cancelled" || otherFields.length > 0) {
    return res.status(403).json({ error: "Customers can only cancel a pending order" });
  }
  if (req.resource?.status !== "pending") {
    return res.status(400).json({ error: `Cannot cancel an order that is ${req.resource?.status}` });
  }

  req.body = { status: "cancelled" };
  next();
};

// Deleting orders and changing payment records are admin actions.
const adminOnly = (req, res) => res.status(403).json({ error: "This action is not available to customers" });

// Orders endpoints
router.get("/user/:userId", requireParamUserIdMatch, orderController.getOrders);
router.post("/", requireBodyUserIdMatch, orderController.createOrder);
router.get(
  "/number/:orderNumber",
  requireOrderNumberOwnership,
  orderController.getOrderByNumber
);
router.put("/:id", requireOrderOwnership, allowCustomerCancelOnly, orderController.updateOrder);
router.delete("/:id", adminOnly);
router.get("/:id", requireOrderOwnership, orderController.getOrder);

// Payments sub-resource endpoints
router.post("/:orderId/payments", requirePaymentOrderOwnership, orderController.createPayment);
router.get("/:orderId/payments", requirePaymentOrderOwnership, orderController.getPayments);
router.get("/:orderId/payments/:paymentId", requirePaymentOrderOwnership, orderController.getPayment);
router.put("/:orderId/payments/:paymentId", adminOnly);

module.exports = router;
