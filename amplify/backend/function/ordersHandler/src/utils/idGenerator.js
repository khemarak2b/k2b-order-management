const { nanoid } = require('nanoid');

/**
 * Generate a Nano ID for orders
 * @returns {string} Nano ID as string
 */
exports.generateOrderId = () => {
  return nanoid();
};

/**
 * Generate a formatted order ID (e.g., "ORD-abc123xyz...")
 * @returns {string} Formatted order ID
 */
exports.generateFormattedOrderId = () => {
  const id = nanoid(10);
  return `ORD-${id}`;
};
