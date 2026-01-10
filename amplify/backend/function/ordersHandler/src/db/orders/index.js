const { 
    getOrder,
    getOrders,
    getCart
} = require('./read');
const { createOrder, createCart } = require('./create');
const { updateOrder , updateCart } = require('./update');
const { deleteOrder , deleteCart} = require('./delete');
 
module.exports = {
   getOrder,
   getOrders,
   getCart,
   deleteOrder,
   deleteCart,
   createOrder,
   createCart,
   updateOrder,
   updateCart
};
