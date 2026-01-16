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

module.exports = router;
