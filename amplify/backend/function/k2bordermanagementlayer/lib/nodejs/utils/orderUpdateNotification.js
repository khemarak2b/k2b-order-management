const { createHash } = require("crypto");

const STATUS_SUBJECTS = {
  pending: (orderNumber) => `Order #${orderNumber} is pending`,
  processing: (orderNumber) => `Order #${orderNumber} is being processed`,
  shipped: (orderNumber) => `Order #${orderNumber} has shipped`,
  delivered: (orderNumber) => `Order #${orderNumber} has been delivered`,
  cancelled: (orderNumber) => `Order #${orderNumber} has been cancelled`,
  refunded: (orderNumber) => `Order #${orderNumber} has been refunded`,
};

function normalized(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function logNotification(level, event, details = {}) {
  const logger = console[level] || console.log;
  logger(JSON.stringify({ component: "order-update-email", event, ...details }));
}

function buildDeduplicationId(order, updateType) {
  const source = [order.id, order.updated_at || order.updatedAt || "unknown", updateType].join(":");
  return `order-update-${createHash("sha256").update(source).digest("hex")}`;
}

function getOrderUpdateDecision(previousOrder, updatedOrder) {
  if (!previousOrder || !updatedOrder) {
    return null;
  }

  const statusChanged = normalized(previousOrder.status) !== normalized(updatedOrder.status);
  const trackingChanged =
    normalized(previousOrder.tracking_number) !== normalized(updatedOrder.tracking_number) ||
    normalized(previousOrder.tracking_url) !== normalized(updatedOrder.tracking_url);

  if (!statusChanged && !trackingChanged) {
    return null;
  }

  const updateType = statusChanged ? "status" : "tracking";
  const orderNumber = updatedOrder.order_number;
  const status = normalized(updatedOrder.status).toLowerCase();
  const statusSubject = STATUS_SUBJECTS[status];

  return {
    statusChanged,
    trackingChanged,
    updateType,
    subject:
      updateType === "status"
        ? statusSubject?.(orderNumber) || `Order #${orderNumber} has been updated`
        : `Tracking updated for order #${orderNumber}`,
    template: updateType === "status" ? "order-status-updated" : "order-tracking-updated",
    messageGroupId: `order-${updatedOrder.id}`,
    messageDeduplicationId: buildDeduplicationId(updatedOrder, updateType),
  };
}

async function notifyCustomerOfOrderUpdate({
  pool,
  previousOrder,
  updatedOrder,
  sendNotification,
  source = "unknown",
}) {
  const decision = getOrderUpdateDecision(previousOrder, updatedOrder);
  const orderId = updatedOrder?.id || previousOrder?.id;

  if (!decision) {
    logNotification("info", "skipped", { orderId, source, reason: "no-qualifying-change" });
    return { queued: false, reason: "no-qualifying-change" };
  }

  try {
    const schema = process.env.ENVIRONMENT || "dev";
    const result = await pool.query(
      `SELECT email, first_name, last_name FROM ${schema}.users WHERE id = $1`,
      [updatedOrder.user_id],
    );
    const customer = result.rows[0];

    if (!customer?.email) {
      logNotification("warn", "skipped", { orderId, source, reason: "customer-email-missing" });
      return { queued: false, reason: "customer-email-missing" };
    }

    const customerName = [customer.first_name, customer.last_name]
      .map(normalized)
      .filter(Boolean)
      .join(" ") || "there";

    await sendNotification({
      to: customer.email,
      subject: decision.subject,
      template: decision.template,
      messageGroupId: decision.messageGroupId,
      messageDeduplicationId: decision.messageDeduplicationId,
      data: {
        customerName,
        orderId: updatedOrder.id,
        orderNumber: updatedOrder.order_number,
        newStatus: updatedOrder.status,
        trackingNumber: updatedOrder.tracking_number || null,
        trackingUrl: updatedOrder.tracking_url || null,
      },
    });

    logNotification("info", "queued", {
      orderId,
      source,
      updateType: decision.updateType,
      statusChanged: decision.statusChanged,
      trackingChanged: decision.trackingChanged,
    });
    return { queued: true, updateType: decision.updateType };
  } catch (error) {
    logNotification("error", "enqueue-failed", {
      orderId,
      source,
      updateType: decision.updateType,
      error: error.message,
    });
    return { queued: false, reason: "enqueue-failed" };
  }
}

module.exports = {
  getOrderUpdateDecision,
  notifyCustomerOfOrderUpdate,
};
