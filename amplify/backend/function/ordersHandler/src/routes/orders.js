const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

// Product CRUD operations
//router.get('/search/:query', orderController.searchProducts);
//router.get('/', orderController.getAllProducts);
//router.get('/:id/variants', orderController.getProductVariants);
router.get('/:id', orderController.getOrder);
//router.post('/', orderController.createProduct);
//router.put('/:id', orderController.updateProduct);
//router.delete('/:id', orderController.deleteProduct);

module.exports = router;
