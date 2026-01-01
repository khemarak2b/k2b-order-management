const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

// Product CRUD operations
//router.get('/search/:query', orderController.searchProducts);
//router.get('/', orderController.getAllProducts);
//router.get('/:id/variants', orderController.getProductVariants);
router.get('/:id', orderController.getCart);
router.delete('/:id', orderController.deleteCart);
router.post('/', orderController.createCart);
router.post('/', orderController.updateCart);

module.exports = router;
