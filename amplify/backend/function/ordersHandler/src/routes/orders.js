const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

// Product CRUD operations
//router.get('/search/:query', orderController.searchProducts);
//router.get('/', orderController.getAllProducts);
//router.get('/:id/variants', orderController.getProductVariants);
router.get('/getOrder/:id', orderController.getOrder);
router.get('/getOrders/:user_id', orderController.getOrders);
router.delete('/deleteOrder/:id', orderController.deleteOrder);
router.post('/createOrder', orderController.createOrder);
router.post('/updateOrder', orderController.updateOrder);
router.get('/getCart/:id', orderController.getCart);
router.delete('/deleteCart/:id', orderController.deleteCart);
router.post('/createCart', orderController.createCart);
router.post('/updateCart', orderController.updateCart);

module.exports = router;
