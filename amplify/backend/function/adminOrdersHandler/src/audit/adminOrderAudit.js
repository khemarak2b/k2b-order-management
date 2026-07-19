const { emitAuditEvent } = require("/opt/nodejs/utils/auditClient");

const SAFE_ORDER_FIELDS = [
  "orderNumber",
  "status",
  "totalAmount",
  "subtotal",
  "taxAmount",
  "shippingCost",
  "discountAmount",
  "currencyCode",
  "trackingUrl",
  "pricingProfileId",
];
const SAFE_PAYMENT_FIELDS = ["paymentMethod", "amount", "status"];

async function auditAdminOrderEvent(
  req,
  { eventType, action, severity, category = "ORDER_ADMIN", resourceType = "ORDER", order, payment, item, changes, metadata = {} },
) {
  try {
    const resource = buildResource(req, resourceType, order, payment, item);
    return await emitAuditEvent(
      {
        service: "order-management",
        tenantId: readField(order, "tenantId") || getHeader(req, "x-k2b-audit-tenant-id") || "platform",
        eventType,
        action,
        category,
        severity,
        actor: buildActor(req),
        resource,
        outcome: { status: "SUCCESS" },
        changes,
        metadata: {
          orderId: readField(order, "id") || req.params?.orderId || req.params?.id || "",
          orderNumber: readField(order, "orderNumber") || "",
          customerId: readField(order, "userId") || "",
          paymentId: readField(payment, "id") || "",
          orderItemId: readField(item, "id") || "",
          productId: readField(item, "productId") || "",
          variantId: readField(item, "variantId") || "",
          ...metadata,
        },
      },
      { req },
    );
  } catch (error) {
    console.error("Unexpected admin order audit failure", {
      eventType,
      orderId: readField(order, "id") || req.params?.orderId || req.params?.id,
      errorMessage: error.message,
    });
    return { ok: false, errorType: "AUDIT_HELPER_FAILED" };
  }
}

function buildOrderChanges(beforeOrder, afterOrder) {
  return buildChanges(beforeOrder, afterOrder, SAFE_ORDER_FIELDS);
}

function buildPaymentChanges(beforePayment, afterPayment) {
  return buildChanges(beforePayment, afterPayment, SAFE_PAYMENT_FIELDS);
}

function pickSafeOrderFields(order) {
  return pickFields(order, SAFE_ORDER_FIELDS);
}

function pickSafePaymentFields(payment) {
  return pickFields(payment, SAFE_PAYMENT_FIELDS);
}

function findOrderItem(order, itemId) {
  const items = order?.items || order?.order_items || [];
  return items.find((item) => String(readField(item, "id")) === String(itemId));
}

function buildChanges(beforeValue, afterValue, fields) {
  const before = {};
  const after = {};
  for (const field of fields) {
    const previous = normalizeValue(readField(beforeValue, field));
    const current = normalizeValue(readField(afterValue, field));
    if (previous !== current) {
      before[field] = previous;
      after[field] = current;
    }
  }
  return { before, after };
}

function pickFields(value, fields) {
  return Object.fromEntries(
    fields
      .map((field) => [field, normalizeValue(readField(value, field))])
      .filter(([, fieldValue]) => fieldValue !== undefined),
  );
}

function buildResource(req, resourceType, order, payment, item) {
  if (resourceType === "PAYMENT") {
    return {
      type: "PAYMENT",
      id: String(readField(payment, "id") || req.params?.paymentId || ""),
      name: readField(payment, "paymentMethod") || "Order payment",
      ownerId: String(readField(order, "userId") || ""),
    };
  }
  if (resourceType === "ORDER_ITEM") {
    return {
      type: "ORDER_ITEM",
      id: String(readField(item, "id") || req.params?.itemId || ""),
      name: readField(item, "productName") || readField(item, "variantTitle") || "Order item",
      ownerId: String(readField(order, "userId") || ""),
    };
  }
  return {
    type: "ORDER",
    id: String(readField(order, "id") || req.params?.id || ""),
    name: readField(order, "orderNumber") || "Order",
    ownerId: String(readField(order, "userId") || ""),
  };
}

function buildActor(req) {
  const user = req.user || {};
  return {
    id: String(user.adminId || user.sub || "unknown"),
    type: "ADMIN",
    email: user.email || "",
    name: user.name || "",
    roles: user.role ? [user.role] : user.roles || [],
  };
}

function readField(value, camelField) {
  if (!value) return undefined;
  const snakeField = camelField.replace(/([A-Z])/g, "_$1").toLowerCase();
  return value[camelField] ?? value[snakeField];
}

function normalizeValue(value) {
  if (value instanceof Date) return value.toISOString();
  return value === null ? undefined : value;
}

function getHeader(req, name) {
  const headers = req?.headers || {};
  const matchedKey = Object.keys(headers).find((key) => key.toLowerCase() === name.toLowerCase());
  return matchedKey ? headers[matchedKey] : "";
}

module.exports = {
  auditAdminOrderEvent,
  buildOrderChanges,
  buildPaymentChanges,
  findOrderItem,
  pickSafeOrderFields,
  pickSafePaymentFields,
};
