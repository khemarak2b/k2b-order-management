const { emitAuditEvent } = require("/opt/nodejs/utils/auditClient");

async function auditCartEvent(
  req,
  { eventType, action, resourceType = "CART", cart, item, changes, metadata = {} },
) {
  try {
    const user = req.user || {};
    const cartId = readField(cart, "id") || readField(item, "cartId") || "";
    const customerId = readField(cart, "userId") || user.id || req.params?.userId || "";
    return await emitAuditEvent(
      {
        service: "order-management",
        tenantId: getHeader(req, "x-k2b-audit-tenant-id") || "unknown",
        eventType,
        action,
        category: "SHOPPING",
        severity: eventType === "CART_DELETED" ? "MEDIUM" : "LOW",
        actor: {
          id: String(user.id || user.sub || "unknown-customer"),
          type: user.id || user.sub ? "CUSTOMER" : "UNKNOWN",
          email: "",
          name: "",
          roles: [],
        },
        resource:
          resourceType === "CART_ITEM"
            ? {
                type: "CART_ITEM",
                id: String(readField(item, "id") || req.params?.itemId || ""),
                name: "Cart item",
                ownerId: String(customerId),
              }
            : {
                type: "CART",
                id: String(cartId),
                name: "Customer cart",
                ownerId: String(customerId),
              },
        outcome: { status: "SUCCESS" },
        changes,
        metadata: {
          cartId: String(cartId),
          customerId: String(customerId),
          productId: String(readField(item, "productId") || ""),
          variantId: String(readField(item, "variantId") || ""),
          quantity: numberOrUndefined(readField(item, "quantity")),
          ...metadata,
        },
      },
      { req },
    );
  } catch (error) {
    console.error("Unexpected cart audit failure", {
      eventType,
      cartId: readField(cart, "id") || readField(item, "cartId") || "",
      errorMessage: error.message,
    });
    return { ok: false, errorType: "AUDIT_HELPER_FAILED" };
  }
}

function buildCartItemChanges(beforeItem, afterItem) {
  const previousQuantity = numberOrUndefined(readField(beforeItem, "quantity"));
  const currentQuantity = numberOrUndefined(readField(afterItem, "quantity"));
  const before = {};
  const after = {};
  if (previousQuantity !== currentQuantity) {
    if (previousQuantity !== undefined) before.quantity = previousQuantity;
    if (currentQuantity !== undefined) after.quantity = currentQuantity;
  }
  return { before, after };
}

function findCartItem(cart, itemId) {
  return (cart?.items || []).find(
    (item) => String(readField(item, "id")) === String(itemId),
  );
}

function readField(value, camelField) {
  if (!value) return undefined;
  const snakeField = camelField.replace(/([A-Z])/g, "_$1").toLowerCase();
  return value[camelField] ?? value[snakeField];
}

function numberOrUndefined(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function getHeader(req, name) {
  const headers = req?.headers || {};
  const matchedKey = Object.keys(headers).find(
    (key) => key.toLowerCase() === name.toLowerCase(),
  );
  return matchedKey ? headers[matchedKey] : "";
}

module.exports = { auditCartEvent, buildCartItemChanges, findCartItem };
