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
            return res.status(404).json({ error: 'Product not found' });
        }
        
        res.json(formatResponse(order));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


