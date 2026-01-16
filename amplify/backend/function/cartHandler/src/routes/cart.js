const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cartController");

// Cart endpoints
router.get("/:userId", cartController.getCart);
router.post("/", cartController.createCart);
router.post("/:userId/items", cartController.addCartItem);
router.put("/:userId/items/:itemId", cartController.updateCartItem);
router.delete("/:userId/items/:itemId", cartController.deleteCartItem);
router.delete("/:userId", cartController.deleteCart);

module.exports = router;
