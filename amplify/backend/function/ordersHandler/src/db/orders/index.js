const { 
    getOrder,
    getOrders,
    getCart,
    getPayment,
    getPayments
} = require('./read');
const { createOrder, createCart, addCartItem, createPayment } = require('./create');
const { updateOrder, updateCart, updateCartItem, updatePayment } = require('./update');
const { deleteOrder, deleteCart, deleteCartItem } = require('./delete');
 
module.exports = {
   getOrder,
   getOrders,
   getCart,
   getPayment,
   getPayments,
   deleteOrder,
   deleteCart,
   deleteCartItem,
   createOrder,
   createCart,
   addCartItem,
   createPayment,
   updateOrder,
   updateCart,
   updateCartItem,
   updatePayment
};
