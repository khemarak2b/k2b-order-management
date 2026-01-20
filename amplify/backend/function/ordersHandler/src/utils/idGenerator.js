import crypto from "crypto";

/**
 * Generate a formatted order ID (e.g., "ORD-abc123xyz...")
 * @returns {string} Formatted order ID
 */
exports.generateFormattedOrderId = () => {
  const timestamp = Date.now().toString().slice(-6); // last 6 digits
  const random1 = crypto.randomInt(1000, 10000);
  const random2 = crypto.randomInt(1000, 10000);

  return `${random1}-${timestamp}-${random2}`;
};
