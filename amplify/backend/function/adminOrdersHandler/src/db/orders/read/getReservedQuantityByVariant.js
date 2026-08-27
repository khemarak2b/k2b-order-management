/**
 * Sum quantity currently held by pending/processing orders per variant —
 * this is the "reserved" amount subtracted from Shopify's live available
 * quantity during order-creation stock validation. Self-corrects as order
 * status changes (no separate counter to keep in sync or reverse).
 */
async function getReservedQuantityByVariant(pool, variantIds) {
  const client = await pool.connect();
  const schema = process.env.ENVIRONMENT || "dev";

  try {
    if (!Array.isArray(variantIds) || variantIds.length === 0) {
      return new Map();
    }

    const result = await client.query(
      `SELECT oi.variant_id, SUM(oi.quantity) AS reserved_quantity
       FROM ${schema}.order_items oi
       JOIN ${schema}.orders o ON o.id = oi.order_id
       WHERE oi.variant_id = ANY($1::int[]) AND o.status IN ('pending', 'processing')
       GROUP BY oi.variant_id`,
      [variantIds],
    );

    return new Map(result.rows.map((row) => [row.variant_id, Number(row.reserved_quantity)]));
  } finally {
    client.release();
  }
}

module.exports = getReservedQuantityByVariant;
