const { getOrder, getOrders, getPayment, getPayments } = require("./read");
const { createPayment } = require("./create");
const { updateOrder, updatePayment } = require("./update");
const { deleteOrder } = require("./delete");

module.exports = {
  getOrder,
  getOrders,
  getPayment,
  getPayments,
  deleteOrder,
  createPayment,
  updateOrder,
  updatePayment,
};
