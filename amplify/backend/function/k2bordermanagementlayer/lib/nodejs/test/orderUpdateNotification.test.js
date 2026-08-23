const assert = require("node:assert/strict");
const test = require("node:test");
const {
  getOrderUpdateDecision,
  notifyCustomerOfOrderUpdate,
} = require("../utils/orderUpdateNotification");

const baseOrder = {
  id: "order-1",
  user_id: "user-1",
  order_number: "K2B-1001",
  status: "pending",
  tracking_number: null,
  tracking_url: null,
  updated_at: "2026-08-23T10:00:00.000Z",
};

test("builds tailored decisions for every supported status", () => {
  const expectedSubjects = {
    processing: "Order #K2B-1001 is being processed",
    shipped: "Order #K2B-1001 has shipped",
    delivered: "Order #K2B-1001 has been delivered",
    cancelled: "Order #K2B-1001 has been cancelled",
    refunded: "Order #K2B-1001 has been refunded",
  };

  for (const [status, subject] of Object.entries(expectedSubjects)) {
    const decision = getOrderUpdateDecision(baseOrder, { ...baseOrder, status });
    assert.equal(decision.updateType, "status");
    assert.equal(decision.template, "order-status-updated");
    assert.equal(decision.subject, subject);
  }
});

test("detects tracking additions, corrections, and removals", () => {
  const added = { ...baseOrder, tracking_number: "TRACK-1" };
  assert.equal(getOrderUpdateDecision(baseOrder, added).updateType, "tracking");

  const corrected = { ...added, tracking_number: "TRACK-2" };
  assert.equal(getOrderUpdateDecision(added, corrected).updateType, "tracking");

  assert.equal(getOrderUpdateDecision(corrected, baseOrder).updateType, "tracking");
});

test("uses one status notification when status and tracking change together", () => {
  const decision = getOrderUpdateDecision(baseOrder, {
    ...baseOrder,
    status: "processing",
    tracking_number: "TRACK-1",
  });

  assert.equal(decision.updateType, "status");
  assert.equal(decision.statusChanged, true);
  assert.equal(decision.trackingChanged, true);
});

test("does not notify for notes-only or normalized no-op tracking updates", () => {
  assert.equal(getOrderUpdateDecision(baseOrder, { ...baseOrder, notes: "Internal note" }), null);
  assert.equal(getOrderUpdateDecision(baseOrder, { ...baseOrder, tracking_number: "  " }), null);
});

test("queues a customer notification with FIFO metadata and current customer details", async () => {
  const sent = [];
  const result = await notifyCustomerOfOrderUpdate({
    pool: {
      query: async () => ({ rows: [{ email: "customer@example.com", first_name: "Ada", last_name: "Lovelace" }] }),
    },
    previousOrder: baseOrder,
    updatedOrder: { ...baseOrder, status: "shipped", tracking_number: "TRACK-1" },
    sendNotification: async (message) => sent.push(message),
    source: "test",
  });

  assert.equal(result.queued, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].messageGroupId, "order-order-1");
  assert.match(sent[0].messageDeduplicationId, /^order-update-[a-f0-9]{64}$/);
  assert.equal(sent[0].data.customerName, "Ada Lovelace");
  assert.equal(sent[0].data.trackingNumber, "TRACK-1");
});

test("skips missing email and contains enqueue failures", async () => {
  const updatedOrder = { ...baseOrder, status: "processing" };
  const missingEmail = await notifyCustomerOfOrderUpdate({
    pool: { query: async () => ({ rows: [{ first_name: "Ada" }] }) },
    previousOrder: baseOrder,
    updatedOrder,
    sendNotification: async () => assert.fail("notification should not be called"),
  });
  assert.deepEqual(missingEmail, { queued: false, reason: "customer-email-missing" });

  const failedEnqueue = await notifyCustomerOfOrderUpdate({
    pool: { query: async () => ({ rows: [{ email: "customer@example.com" }] }) },
    previousOrder: baseOrder,
    updatedOrder,
    sendNotification: async () => {
      throw new Error("notification API unavailable");
    },
  });
  assert.deepEqual(failedEnqueue, { queued: false, reason: "enqueue-failed" });
});
