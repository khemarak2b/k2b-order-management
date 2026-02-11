const createInvoice = require("./create/createInvoice");
const getInvoice = require("./read/getInvoice");
const getInvoices = require("./read/getInvoices");
const getInvoiceByOrder = require("./read/getInvoiceByOrder");
const getUserInvoices = require("./read/getUserInvoices");
const updateInvoice = require("./update/updateInvoice");
const deleteInvoice = require("./delete/deleteInvoice");
const recordPayment = require("./update/recordPayment");

module.exports = {
  createInvoice,
  getInvoice,
  getInvoices,
  getInvoiceByOrder,
  getUserInvoices,
  updateInvoice,
  deleteInvoice,
  recordPayment,
};
