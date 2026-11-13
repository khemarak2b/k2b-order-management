const { pickColumns } = require("/opt/nodejs/utils/sqlColumns");
const { CART_ITEM_UPDATE_COLUMNS } = require("../columns");

const updateCartItem = async (pool, itemId, updateData) => {
  // Only known columns: the keys come from the request body.
  const fields = pickColumns(updateData, CART_ITEM_UPDATE_COLUMNS);
  const cols = Object.keys(fields);
  const vals = Object.values(fields);

  if (cols.length === 0) {
    throw Object.assign(new Error("No cart item fields to update"), { status: 400 });
  }

  const client = await pool.connect();
  const schema = process.env.ENVIRONMENT || "dev";

  try {

    const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(", ");

    const result = await client.query(
      `
      UPDATE ${schema}.cart_items
      SET ${setClause}, updated_at = NOW()
      WHERE id = $${cols.length + 1}
      RETURNING *
      `,
      [...vals, itemId]
    );

    if (result.rows.length === 0) {
      throw new Error("Cart item not found");
    }

    return result.rows[0];
  } finally {
    client.release();
  }
};

module.exports = updateCartItem;
