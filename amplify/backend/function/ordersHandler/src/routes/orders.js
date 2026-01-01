const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

// Product CRUD operations
//router.get('/search/:query', orderController.searchProducts);
//router.get('/', orderController.getAllProducts);
//router.get('/:id/variants', orderController.getProductVariants);
router.get('/:id', orderController.getOrder);
router.get('/:cart_id', orderController.getCart);
router.delete('/:id', orderController.deleteCart);
router.delete('/:id', orderController.deleteOrder);
router.post('/', orderController.createOrder);
router.post('/', orderController.createCart);
router.post('/', orderController.updateOrder);
router.post('/', orderController.updateCart);

module.exports = router;
