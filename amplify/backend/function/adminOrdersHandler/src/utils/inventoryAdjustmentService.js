const { k2bproductmanagement } = require("../k2b-product-management-aws-exports");
const { getParameterStoreValueByKey } = require("/opt/nodejs/utils/parameterStoreHelper");

function getProductManagementApiUrl() {
  const api = k2bproductmanagement.aws_cloud_logic_custom.find((a) => a.name === "productManagementApi");
  if (!api) {
    throw new Error("Product management API configuration not found");
  }
  return api.endpoint;
}

async function getInventoryAdjustToken() {
  const parameterName = process.env.SHOPIFY_INVENTORY_ADJUST_TOKEN_PARAMETER_NAME;
  if (!parameterName) {
    throw new Error("SHOPIFY_INVENTORY_ADJUST_TOKEN_PARAMETER_NAME environment variable is not configured");
  }
  const parameters = await getParameterStoreValueByKey([parameterName], true);
  return parameters.get(parameterName)?.Value || "";
}

/**
 * Best-effort call to k2b-product-management to decrement Shopify inventory
 * for the locations an admin selected while fulfilling an order. Never
 * throws — the caller's order status update must succeed regardless of
 * whether Shopify could be reached.
 *
 * @param {Object} params
 * @param {number|string} params.orderId
 * @param {string} params.orderNumber
 * @param {Array<{variantId: number, shopifyLocationId: string, quantity: number}>} params.items
 */
async function adjustShopifyInventoryForOrder({ orderId, orderNumber, items }) {
  if (!Array.isArray(items) || items.length === 0) {
    return { requested: false, reason: "no-items" };
  }

  try {
    const apiUrl = getProductManagementApiUrl();
    const token = await getInventoryAdjustToken();

    const response = await fetch(`${apiUrl}/inventory-adjustments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Inventory-Adjust-Token": token },
      body: JSON.stringify({ orderId, orderNumber, items }),
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(
        JSON.stringify({
          component: "inventory-adjust-client",
          event: "adjust-failed",
          orderId,
          status: response.status,
        }),
      );
      return { requested: true, ok: false, status: response.status };
    }

    console.log(JSON.stringify({ component: "inventory-adjust-client", event: "adjust-succeeded", orderId }));
    return { requested: true, ok: true, result: body };
  } catch (error) {
    console.error(
      JSON.stringify({
        component: "inventory-adjust-client",
        event: "adjust-error",
        orderId,
        error: error.message,
      }),
    );
    return { requested: true, ok: false, error: error.message };
  }
}

module.exports = { adjustShopifyInventoryForOrder };
