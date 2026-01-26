const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cartController");
const { authMiddleware } = require("/opt/nodejs/middleware/authMiddleware");
const { createOwnershipMiddleware, requireUserIdMatch } = require("/opt/nodejs/middleware/authorizationMiddleware");

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
