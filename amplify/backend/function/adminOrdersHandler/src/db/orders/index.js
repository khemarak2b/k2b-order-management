const { getOrder, getOrderByOrderNumber, getOrders, getAllOrders, getPayment, getPayments } = require("./read");
const { createPayment } = require("./create");
const { updateOrder, updatePayment, updateOrderItemQuantity } = require("./update");
const { deleteOrder } = require("./delete");

module.exports = {
  getOrder,
  getOrderByOrderNumber,
  getOrders,
  getAllOrders,
  getPayment,
  getPayments,
  deleteOrder,
  createPayment,
  updateOrder,
  updatePayment,
  updateOrderItemQuantity,
};
