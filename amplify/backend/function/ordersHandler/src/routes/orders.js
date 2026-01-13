const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");

// Orders
router.get("/:id", orderController.getOrder);
router.get("/user/:userId", orderController.getOrders);
router.post("/", orderController.createOrder);
router.put("/:id", orderController.updateOrder);
router.delete("/:id", orderController.deleteOrder);

// Carts
router.get("/cart/:id", orderController.getCart);
router.post("/cart", orderController.createCart);
router.put("/cart/:id", orderController.updateCart);
router.delete("/cart/:id", orderController.deleteCart);

module.exports = router;

// old
// router.get('/getOrder/:id', orderController.getOrder);
// router.get('/getOrders/:user_id', orderController.getOrders);
// router.delete('/deleteOrder/:id', orderController.deleteOrder);
// router.post('/createOrder', orderController.createOrder);
// router.post('/updateOrder', orderController.updateOrder);
// router.get('/getCart/:id', orderController.getCart);
// router.delete('/deleteCart/:id', orderController.deleteCart);
// router.post('/createCart', orderController.createCart);
// router.post('/updateCart', orderController.updateCart);
