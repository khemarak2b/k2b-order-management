const {
  getOrder,
  getOrderByNumber,
  getOrders,
  getCart,
  getPayment,
  getPayments,
} = require("./read");
// Cart writes live in cartHandler.
const { createOrder, createPayment } = require("./create");
const { updateOrder, updatePayment } = require("./update");
const { deleteOrder, deleteCart, deleteCartItem } = require("./delete");

module.exports = {
  getOrder,
  getOrderByNumber,
  getOrders,
  getCart,
  getPayment,
  getPayments,
  deleteOrder,
  deleteCart,
  deleteCartItem,
  createOrder,
  createPayment,
  updateOrder,
  updatePayment,
};
