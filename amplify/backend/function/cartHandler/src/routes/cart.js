const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cartController");
const { authMiddleware } = require("/opt/nodejs/middleware/authMiddleware");
const { createOwnershipMiddleware, requireUserIdMatch } = require("/opt/nodejs/middleware/authorizationMiddleware");

// Apply auth middleware to all routes
router.use(authMiddleware);

// Create reusable middleware for carts
const requireCartOwnership = createOwnershipMiddleware(
  async (req) => ({ user_id: req.params.userId }), // Simple mock since cart is identified by userId
  "user_id",
);

const requireBodyUserIdMatch = requireUserIdMatch((req) => req.body.userId);
const requireParamUserIdMatch = requireUserIdMatch((req) => req.params.userId);

// Cart endpoints
router.get("/:userId", requireParamUserIdMatch, cartController.getCart);
router.post("/", requireBodyUserIdMatch, cartController.createCart);
router.post("/:userId/items", requireParamUserIdMatch, cartController.addCartItem);
router.put("/:userId/items/:itemId", requireParamUserIdMatch, cartController.updateCartItem);
router.delete("/:userId/items/:itemId", requireParamUserIdMatch, cartController.deleteCartItem);
router.delete("/:userId", requireParamUserIdMatch, cartController.deleteCart);

module.exports = router;
