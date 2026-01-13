const orderDb = require('../db/orders');
const { formatResponse } = require('../utils/responseFormatter');
const { toSnakeCase } = require('../utils/caseConverter');

exports.getOrder = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!id) {
            return res.status(400).json({ error: 'Order ID is required' });
        }
        
        const order = await orderDb.getOrder(req.pool, id);
        
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        res.json(formatResponse(order));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getOrders = async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }
        
        const order = await orderDb.getOrders(req.pool, userId);
        
        if (!order) {
            return res.status(404).json({ error: 'Orders not found' });
        }
        
        res.json(formatResponse(order));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getCart = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!id) {
            return res.status(400).json({ error: 'Cart is required' });
        }
        
        const cart = await orderDb.getCart(req.pool, id);
        
        if (!cart) {
            return res.status(404).json({ error: 'Cart not found' });
        }
        
        res.json(formatResponse(cart));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.deleteOrder = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!id) {
            return res.status(400).json({ error: 'Order ID is required' });
        }
        
        await orderDb.deleteOrder(req.pool, id);
        res.status(204).send();
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.deleteCart = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!id) {
            return res.status(400).json({ error: 'Cart ID is required' });
        }
        
        await orderDb.deleteCart(req.pool, id);
        res.status(204).send();
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.createOrder = async (req, res) => {
     try {
         console.log('[createOrder] Request body:', JSON.stringify(req.body));         
         const { userId, status, totalAmount } = req.body.order;    
         
         if (userId == undefined || userId == null) {
             return res.status(400).json({ error: 'Invalid userId: must be a not null value' });
         }
         if (status == undefined || status == null) {
             return res.status(400).json({ error: 'Invalid status: must be a not null value' });
         }
         if (totalAmount !== undefined && totalAmount !== null) {
             if (isNaN(totalAmount) || parseFloat(totalAmount) < 0) {
                 return res.status(400).json({ error: 'Invalid totalAmount: must be a non-negative number' });
             }
         }      
         
         const dbData = toSnakeCase(req.body.order);
         console.log('[createOrder] Creating Order with data:', JSON.stringify(dbData));
         const order = await orderDb.createOrder(req.pool, dbData);         
         console.log('[createOrder] Order created successfully:', JSON.stringify(order));
         res.status(201).json(formatResponse(order));
     } catch (error) {
         console.error('[createOrder] Error:', error.message, error.stack);
         res.status(500).json({ error: 'Internal server error' });
     }
};

exports.createCart = async (req, res) => {
     try {
         console.log('[createCart] Request body:', JSON.stringify(req.body));   
         const {  userId , status  } = req.body;    

         if (userId == undefined || userId == null) {
                 return res.status(400).json({ error: 'Invalid userId: must be a not null value' });
         }
         if (status == undefined || status == null) {
                 return res.status(400).json({ error: 'Invalid status: must be a not null value' });
         }

         const dbData = toSnakeCase(req.body);
         console.log('[createCart] Creating cart with data:', JSON.stringify(dbData));
         const order = await orderDb.createCart(req.pool, dbData);         
         console.log('[createCart] cart created successfully:', JSON.stringify(order));
         res.status(201).json(formatResponse(order));
     } catch (error) {
         console.error('[createCart] Error:', error.message, error.stack);
         res.status(500).json({ error: 'Internal server error' });
     }
};

exports.updateOrder = async (req, res) => {
     try {
         console.log('[updateOrder] Request body:', JSON.stringify(req.body));         
         const {cartId, userId, orderNumber, status, totalAmount, payMethod, createdAt, updatedAt } = req.body.order;    
         
         if (userId == undefined || userId == null) {
             return res.status(400).json({ error: 'Invalid userId: must be a not null value' });
         }
         if (status !== undefined || status !== null) {
             return res.status(400).json({ error: 'Invalid status: must be a not null value' });
         }
         if (totalAmount !== undefined && totalAmount !== null) {
             if (isNaN(totalAmount) || parseFloat(totalAmount) < 0) {
                 return res.status(400).json({ error: 'Invalid totalAmount: must be a non-negative number' });
             }
         }      
         
         const dbData = toSnakeCase(req.body.order);
         console.log('[updateOrder] Updating Order with data:', JSON.stringify(dbData));
         const order = await orderDb.updateOrder(req.pool, dbData);         
         console.log('[updateOrder] Order updated successfully:', JSON.stringify(order));
         res.status(200).json(formatResponse(order));
     } catch (error) {
         console.error('[updateOrder] Error:', error.message, error.stack);
         res.status(500).json({ error: 'Internal server error' });
     }
};

exports.updateCart = async (req, res) => {
     try {
         console.log('[updateCart] Request body:', JSON.stringify(req.body));         
         const {cartItemId , cartId , productId , quantity , unitPrice , createdAt , updatedAt } = req.body.cart;    

         if (cartId == undefined || cartId == null) {
             return res.status(400).json({ error: 'Invalid cartId: must be a not null value' });
         }
         if (productId == undefined || productId == null) {
             return res.status(400).json({ error: 'Invalid productId: must be a not null value' });
         }
         if (unitPrice !== undefined && unitPrice !== null) {
             if (isNaN(unitPrice) || parseFloat(unitPrice) < 0) {
                 return res.status(400).json({ error: 'Invalid unitPrice: must be a non-negative number' });
             }
         }
         if (quantity !== undefined && quantity !== null) {
             if (isNaN(quantity) || parseFloat(quantity) < 0) {
                 return res.status(400).json({ error: 'Invalid quantity: must be a non-negative number' });
             }
         }

         const dbData = toSnakeCase(req.body.cart);
         console.log('[updateCart] Updating cart with data:', JSON.stringify(dbData));
         const order = await orderDb.updateCart(req.pool, dbData);         
         console.log('[updateCart] cart updated successfully:', JSON.stringify(order));
         res.status(200).json(formatResponse(order));
     } catch (error) {
         console.error('[updateCart] Error:', error.message, error.stack);
         res.status(500).json({ error: 'Internal server error' });
     }
};