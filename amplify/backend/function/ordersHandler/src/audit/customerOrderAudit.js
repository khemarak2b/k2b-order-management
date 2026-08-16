const { emitAuditEvent } = require("/opt/nodejs/utils/auditClient");

const SAFE_ORDER_FIELDS = [
  "status",
  "subtotal",
  "taxAmount",
  "shippingCost",
  "discountAmount",
  "totalAmount",
  "currencyCode",
];
const SAFE_PAYMENT_FIELDS = ["paymentMethod", "amount", "status"];

async function auditCustomerOrderEvent(
  req,
  {
    eventType,
    action,
    severity,
    category = "ORDER",
    resourceType = "ORDER",
    order,
    payment,
    changes,
    metadata = {},
  },
) {
  try {
    const user = req.user || {};
    return await emitAuditEvent(
      {
        service: "order-management",
        tenantId:
          readField(order, "tenantId") ||
          getHeader(req, "x-k2b-audit-tenant-id") ||
          "unknown",
        eventType,
        action,
        category,
        severity,
        actor: {
          id: String(user.id || user.sub || "unknown-customer"),
          type: user.id || user.sub ? "CUSTOMER" : "UNKNOWN",
          email: "",
          name: "",
          roles: [],
        },
        resource:
          resourceType === "PAYMENT"
            ? {
                type: "PAYMENT",
                id: String(readField(payment, "id") || req.params?.paymentId || ""),
                name: "Customer order payment",
                ownerId: String(readField(order, "userId") || user.id || ""),
              }
            : {
                type: "ORDER",
                id: String(readField(order, "id") || req.params?.id || ""),
                name: readField(order, "orderNumber") || "Customer order",
                ownerId: String(readField(order, "userId") || user.id || ""),
              },
        outcome: { status: "SUCCESS" },
        changes,
        metadata: {
          orderId: String(readField(order, "id") || req.params?.orderId || req.params?.id || ""),
          orderNumber: readField(order, "orderNumber") || "",
          customerId: String(readField(order, "userId") || user.id || ""),
          paymentId: String(readField(payment, "id") || req.params?.paymentId || ""),
          ...metadata,
        },
      },
      { req },
    );
  } catch (error) {
    console.error("Unexpected customer order audit failure", {
      eventType,
      orderId: readField(order, "id") || req.params?.orderId || req.params?.id || "",
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

function buildChanges(beforeValue, afterValue, fields) {
  const before = {};
  const after = {};
  for (const field of fields) {
    const previous = normalizeValue(readField(beforeValue, field));
    const current = normalizeValue(readField(afterValue, field));
    if (previous !== current) {
      if (previous !== undefined) before[field] = previous;
      if (current !== undefined) after[field] = current;
    }
  }
  return { before, after };
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
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : "";
}

module.exports = { auditCustomerOrderEvent, buildOrderChanges, buildPaymentChanges };
