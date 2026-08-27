const { k2bproductmanagement } = require("../k2b-product-management-aws-exports");
const { getParameterStoreValueByKey } = require("/opt/nodejs/utils/parameterStoreHelper");
const getReservedQuantityByVariant = require("../db/orders/read/getReservedQuantityByVariant");

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
 * Fetch Shopify's live available quantity per variant, for order-creation
 * stock validation. Throws on failure — this is a blocking validation gate,
 * not a best-effort side effect, so a failure here should refuse to create
 * the order rather than silently allowing it through.
 *
 * @param {number[]} variantIds
 * @returns {Promise<Array<{variantId: number, tracked: boolean, availableQuantity: number|null}>>}
 */
async function getLiveStockForVariants(variantIds) {
  const apiUrl = getProductManagementApiUrl();
  const token = await getInventoryAdjustToken();

  const response = await fetch(`${apiUrl}/inventory-adjustments/live-stock`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Inventory-Adjust-Token": token },
    body: JSON.stringify({ variantIds }),
  });

  if (!response.ok) {
    throw new Error(`Live stock check failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Validates that every requested item's quantity is actually sellable right
 * now: Shopify's live available quantity, minus what's already held by this
 * variant's other pending/processing orders. Throws (statusCode 409) if any
 * item exceeds what's sellable. Untracked variants are unlimited.
 *
 * @param {import('pg').Pool} pool
 * @param {Array<{variantId: number|string, quantity: number}>} items
 */
async function validateStockAvailability(pool, items) {
  const variantIds = [...new Set((items || []).map((item) => Number(item.variantId)).filter(Boolean))];
  if (variantIds.length === 0) {
    return;
  }

  const liveStock = await getLiveStockForVariants(variantIds);
  const reserved = await getReservedQuantityByVariant(pool, variantIds);

  const insufficient = [];
  for (const item of items) {
    const variantId = Number(item.variantId);
    const stock = liveStock.find((s) => s.variantId === variantId);
    if (!stock || !stock.tracked) {
      continue;
    }

    const sellable = stock.availableQuantity - (reserved.get(variantId) || 0);
    if (Number(item.quantity) > sellable) {
      insufficient.push({ variantId, requested: Number(item.quantity), available: Math.max(0, sellable) });
    }
  }

  if (insufficient.length > 0) {
    const error = new Error(
      insufficient
        .map((i) => `Only ${i.available} unit(s) available for variant ${i.variantId} (requested ${i.requested})`)
        .join("; "),
    );
    error.statusCode = 409;
    error.details = insufficient;
    throw error;
  }
}

module.exports = { validateStockAvailability };
