const { 
    getOrder,
    getOrders,
    getCart
} = require('./read');
const { createOrder, createCart, addCartItem } = require('./create');
const { updateOrder, updateCart, updateCartItem } = require('./update');
const { deleteOrder, deleteCart, deleteCartItem } = require('./delete');
 
module.exports = {
   getOrder,
   getOrders,
   getCart,
   deleteOrder,
   deleteCart,
   deleteCartItem,
   createOrder,
   createCart,
   addCartItem,
   updateOrder,
   updateCart,
   updateCartItem
};
