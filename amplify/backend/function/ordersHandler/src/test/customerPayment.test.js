const assert = require("node:assert/strict");
const test = require("node:test");
const { validateCustomerPayment } = require("../utils/customerPayment");

// total_amount comes back from Postgres NUMERIC as a string.
const order = (overrides = {}) => ({ id: 1, status: "pending", total_amount: "11.99", payments: [], ...overrides });

const checkoutBody = {
  paymentMethod: "bank_transfer",
  amount: 11.99,
  paymentDetails: { bankName: "", bankReference: "", transferMethod: "" },
};

const rejects = (status, fn) => assert.throws(fn, (error) => error.status === status);

test("accepts what checkout sends for bank transfer", () => {
  assert.deepEqual(validateCustomerPayment(order(), checkoutBody), {
    paymentMethod: "bank_transfer",
    amount: 11.99,
    paymentDetails: { bankName: "", bankReference: "", transferMethod: "" },
  });
});

test("accepts what checkout sends for cash on delivery", () => {
  const result = validateCustomerPayment(order(), {
    paymentMethod: "cash_on_delivery",
    amount: "11.99",
    paymentDetails: { collectionMethod: "cash_on_delivery" },
  });
  assert.equal(result.amount, 11.99);
  assert.deepEqual(result.paymentDetails, { collectionMethod: "cash_on_delivery" });
});

test("rejects an amount that differs from the order total", () => {
  for (const amount of [0.01, 11.98, 12, 1199, 100000]) {
    rejects(400, () => validateCustomerPayment(order(), { ...checkoutBody, amount }));
  }
});

test("tolerates floating-point noise within a cent", () => {
  assert.equal(validateCustomerPayment(order({ total_amount: "0.30" }), { ...checkoutBody, amount: 0.1 + 0.2 }).amount, 0.3);
});

test("rejects bad amounts", () => {
  for (const amount of [undefined, null, 0, -11.99, "abc", "11.99abc", Infinity, [], {}]) {
    rejects(400, () => validateCustomerPayment(order(), { ...checkoutBody, amount }));
  }
});

test("rejects a second payment on the same order", () => {
  rejects(409, () => validateCustomerPayment(order({ payments: [{ id: 7 }] }), checkoutBody));
});

test("rejects a payment once the order has moved on from pending", () => {
  for (const status of ["processing", "shipped", "delivered", "cancelled"]) {
    rejects(409, () => validateCustomerPayment(order({ status }), checkoutBody));
  }
});

test("rejects unknown payment methods", () => {
  for (const paymentMethod of [undefined, "", "credit_card", "paid", "Bank_Transfer", "toString", "__proto__"]) {
    rejects(400, () => validateCustomerPayment(order(), { ...checkoutBody, paymentMethod }));
  }
});

test("keeps only the details the chosen method uses", () => {
  const result = validateCustomerPayment(order(), {
    ...checkoutBody,
    paymentDetails: { bankReference: "ORDER-1", status: "completed", note: "<script>", collectionMethod: "x" },
  });
  assert.deepEqual(result.paymentDetails, { bankReference: "ORDER-1" });
});

test("rejects details that are not short text", () => {
  rejects(400, () => validateCustomerPayment(order(), { ...checkoutBody, paymentDetails: "free text" }));
  rejects(400, () => validateCustomerPayment(order(), { ...checkoutBody, paymentDetails: ["a"] }));
  rejects(400, () => validateCustomerPayment(order(), { ...checkoutBody, paymentDetails: { bankName: { a: 1 } } }));
  rejects(400, () => validateCustomerPayment(order(), { ...checkoutBody, paymentDetails: { bankName: "x".repeat(101) } }));
});

test("details are optional", () => {
  assert.equal(validateCustomerPayment(order(), { paymentMethod: "bank_transfer", amount: 11.99 }).paymentDetails, null);
});
