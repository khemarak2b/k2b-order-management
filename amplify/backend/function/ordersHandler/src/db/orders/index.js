const { 
    getOrder,
    getCart
} = require('./read');
const { createOrder, createCart } = require('./create');
const { updateOrder , updateCart } = require('./update');
const { deleteOrder , deleteCart} = require('./delete');
 
module.exports = {
   getOrder,
   getCart,
   deleteOrder,
   deleteCart,
   createOrder,
   createCart,
   updateOrder,
   updateCart
};
