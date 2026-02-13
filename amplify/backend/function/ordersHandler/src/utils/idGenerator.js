const crypto = require("crypto");
/**
 * Generate a formatted order ID
 * @returns {string} Formatted order ID
 */
exports.generateFormattedOrderId = () => {
  const timestamp = Date.now(); // local epoch ms
  const random = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6 chars

  return `${timestamp}-${random}`;
};
