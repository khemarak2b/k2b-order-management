const { getLiveStockForVariants } = require("./inventoryAdjustmentService");
const getReservedQuantityByVariant = require("../db/orders/read/getReservedQuantityByVariant");

/**
 * Validates that every requested item's quantity is actually sellable right
 * now: Shopify's live available quantity, minus what's already held by this
 * variant's other pending/processing orders. Throws (statusCode 409) if any
 * item exceeds what's sellable. Untracked variants are unlimited. Throws
 * (no statusCode, surfaces as 500/503) if the live stock check itself fails
 * — fail-closed, since silently allowing the order through would defeat the
 * purpose of this check.
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
