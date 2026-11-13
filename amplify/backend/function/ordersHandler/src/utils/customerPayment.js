/**
 * Rules for the payment a customer records at checkout.
 *
 * This record is the customer's chosen payment method for the order, kept as
 * "pending". Money is only counted when an admin records it against the
 * invoice. Admins still see this record on the order, so it must match the
 * order: one per order, for the order's server-computed total, with a known
 * method and only the details that method uses.
 */

// Details the Customer App sends for each method; anything else is dropped.
const ALLOWED_DETAILS = {
  bank_transfer: ["bankName", "bankReference", "transferMethod"],
  cash_on_delivery: ["collectionMethod"],
};
const MAX_DETAIL_LENGTH = 100;

const rejection = (status, message) => Object.assign(new Error(message), { status });

const toCents = (value) => Math.round(Number(value) * 100);

/**
 * @param {object} order the order as read from the database, with its payments
 * @param {object} body the request body
 * @returns {{ paymentMethod: string, amount: number, paymentDetails: object|null }}
 * @throws an Error with a `status` (400 or 409) when the payment is not allowed
 */
function validateCustomerPayment(order, body = {}) {
  const { paymentMethod, amount, paymentDetails } = body || {};

  if (!Object.hasOwn(ALLOWED_DETAILS, paymentMethod)) {
    throw rejection(400, `Payment method must be one of: ${Object.keys(ALLOWED_DETAILS).join(", ")}`);
  }

  const parsedAmount = typeof amount === "number" ? amount : typeof amount === "string" ? Number(amount) : NaN;
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw rejection(400, "Amount must be a positive number");
  }

  if (order.status !== "pending") {
    throw rejection(409, "A payment can only be recorded while the order is pending");
  }
  if (Array.isArray(order.payments) && order.payments.length > 0) {
    throw rejection(409, "This order already has a payment recorded");
  }
  if (toCents(parsedAmount) !== toCents(order.total_amount)) {
    throw rejection(400, "Amount must equal the order total");
  }

  let details = null;
  if (paymentDetails !== undefined && paymentDetails !== null) {
    if (typeof paymentDetails !== "object" || Array.isArray(paymentDetails)) {
      throw rejection(400, "Payment details must be an object");
    }
    details = {};
    for (const key of ALLOWED_DETAILS[paymentMethod]) {
      const value = paymentDetails[key];
      if (value === undefined || value === null) continue;
      if (typeof value !== "string" || value.length > MAX_DETAIL_LENGTH) {
        throw rejection(400, `${key} must be text of at most ${MAX_DETAIL_LENGTH} characters`);
      }
      details[key] = value;
    }
  }

  return { paymentMethod, amount: toCents(order.total_amount) / 100, paymentDetails: details };
}

module.exports = { validateCustomerPayment, ALLOWED_DETAILS };
