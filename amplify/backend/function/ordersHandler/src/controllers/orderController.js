const orderDb = require('../db/orders');
const { formatResponse } = require('../utils/responseFormatter');

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

exports.getCart = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!id) {
            return res.status(400).json({ error: 'Cart is required' });
        }
        
        const order = await orderDb.getCart(req.pool, id);
        
        if (!order) {
            return res.status(404).json({ error: 'Cart not found' });
        }
        
        res.json(formatResponse(order));
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
         const {cart_id, user_id, order_number,status, total_amount, created_at, updated_at } = req.body.order;    
         
         if (user_id == undefined || user_id == null) {
             return res.status(400).json({ error: 'Invalid user_id: must be a not null value' });
         }
         if (status !== undefined || status !== null) {
             return res.status(400).json({ error: 'Invalid status: must be a not null value' });
         }
         if (total_amount !== undefined && total_amount !== null) {
             if (isNaN(total_amount) || parseFloat(total_amount) < 0) {
                 return res.status(400).json({ error: 'Invalid total_amount: must be a non-negative number' });
             }
         }      
         
         console.log('[createOrder] Creating Order with data:', JSON.stringify(req.body));
         const order = await orderDb.createOrder(req.pool, req.body);         
         console.log('[createOrder] Order created successfully:', JSON.stringify(order));
         res.status(201).json(formatResponse(order));
     } catch (error) {
         console.error('[createOrder] Error:', error.message, error.stack);
         res.status(500).json({ error: 'Internal server error' });
     }
};

exports.createCart = async (req, res) => {
     try {
         console.log('[createOrder] Request body:', JSON.stringify(req.body));         
         const {cart_item_id , cart_id , product_id , quantity , unit_price , created_at , updated_at } = req.body.order;    

         if (cart_id == undefined || cart_id == null) {
             return res.status(400).json({ error: 'Invalid cart_id: must be a not null value' });
         }
         if (product_id == undefined || product_id == null) {
             return res.status(400).json({ error: 'Invalid product_id: must be a not null value' });
         }
         if (unit_price !== undefined && unit_price !== null) {
             if (isNaN(unit_price) || parseFloat(unit_price) < 0) {
                 return res.status(400).json({ error: 'Invalid unit_price: must be a non-negative number' });
             }
         }
         if (quantity !== undefined && quantity !== null) {
             if (isNaN(quantity) || parseFloat(quantity) < 0) {
                 return res.status(400).json({ error: 'Invalid quantity: must be a non-negative number' });
             }
         }

         console.log('[createCart] Creating cart with data:', JSON.stringify(req.body));
         const order = await orderDb.createCart(req.pool, req.body);         
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
         const {cart_id, user_id, order_number,status, total_amount, created_at, updated_at } = req.body.order;    
         
         if (user_id == undefined || user_id == null) {
             return res.status(400).json({ error: 'Invalid user_id: must be a not null value' });
         }
         if (status !== undefined || status !== null) {
             return res.status(400).json({ error: 'Invalid status: must be a not null value' });
         }
         if (total_amount !== undefined && total_amount !== null) {
             if (isNaN(total_amount) || parseFloat(total_amount) < 0) {
                 return res.status(400).json({ error: 'Invalid total_amount: must be a non-negative number' });
             }
         }      
         
         console.log('[updateOrder] Creating Order with data:', JSON.stringify(req.body));
         const order = await orderDb.updateOrder(req.pool, req.body);         
         console.log('[updateOrder] Order updated successfully:', JSON.stringify(order));
         res.status(201).json(formatResponse(order));
     } catch (error) {
         console.error('[updateOrder] Error:', error.message, error.stack);
         res.status(500).json({ error: 'Internal server error' });
     }
};

exports.updateCart = async (req, res) => {
     try {
         console.log('[updateCart] Request body:', JSON.stringify(req.body));         
         const {cart_item_id , cart_id , product_id , quantity , unit_price , created_at , updated_at } = req.body.order;    

         if (cart_id == undefined || cart_id == null) {
             return res.status(400).json({ error: 'Invalid cart_id: must be a not null value' });
         }
         if (product_id == undefined || product_id == null) {
             return res.status(400).json({ error: 'Invalid product_id: must be a not null value' });
         }
         if (unit_price !== undefined && unit_price !== null) {
             if (isNaN(unit_price) || parseFloat(unit_price) < 0) {
                 return res.status(400).json({ error: 'Invalid unit_price: must be a non-negative number' });
             }
         }
         if (quantity !== undefined && quantity !== null) {
             if (isNaN(quantity) || parseFloat(quantity) < 0) {
                 return res.status(400).json({ error: 'Invalid quantity: must be a non-negative number' });
             }
         }

         console.log('[updateCart] Creating cart with data:', JSON.stringify(req.body));
         const order = await orderDb.createCart(req.pool, req.body);         
         console.log('[updateCart] cart updated successfully:', JSON.stringify(order));
         res.status(201).json(formatResponse(order));
     } catch (error) {
         console.error('[updateCart] Error:', error.message, error.stack);
         res.status(500).json({ error: 'Internal server error' });
     }
};