const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");

// Orders endpoints
router.get("/user/:userId", orderController.getOrders);
router.post("/", orderController.createOrder);
router.put("/:id", orderController.updateOrder);
router.delete("/:id", orderController.deleteOrder);
router.get("/:id", orderController.getOrder);

// Payments sub-resource endpoints
router.post("/:orderId/payments", orderController.createPayment);
router.get("/:orderId/payments", orderController.getPayments);
router.get("/:orderId/payments/:paymentId", orderController.getPayment);
router.put("/:orderId/payments/:paymentId", orderController.updatePayment);

// Cart endpoints
router.get("/cart/:userId", orderController.getCart);
router.post("/cart", orderController.createCart);
router.post("/cart/:userId/items", orderController.addCartItem);
router.put("/cart/:userId/items/:itemId", orderController.updateCartItem);
router.delete("/cart/:userId/items/:itemId", orderController.deleteCartItem);
router.delete("/cart/:userId", orderController.deleteCart);

module.exports = router;
