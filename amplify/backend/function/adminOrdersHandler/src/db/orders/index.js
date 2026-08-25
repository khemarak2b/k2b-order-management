const { getOrder, getOrderByOrderNumber, getOrders, getAllOrders, getPayment, getPayments } = require("./read");
const { createOrder, createPayment } = require("./create");
const { updateOrder, updatePayment, updateOrderItemQuantity, fulfillOrder } = require("./update");
const { deleteOrder } = require("./delete");

module.exports = {
  getOrder,
  getOrderByOrderNumber,
  getOrders,
  getAllOrders,
  getPayment,
  getPayments,
  deleteOrder,
  createOrder,
  createPayment,
  updateOrder,
  updatePayment,
  updateOrderItemQuantity,
  fulfillOrder,
};
