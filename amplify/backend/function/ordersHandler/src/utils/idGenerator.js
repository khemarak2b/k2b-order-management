const crypto = require("crypto");
/**
 * Generate a formatted order ID
 * @returns {string} Formatted order ID
 */
exports.generateFormattedOrderId = () => {
  const timestamp = Date.now().toString().slice(-6); // last 6 digits
  const random1 = crypto.randomInt(1000, 10000);
  const random2 = crypto.randomInt(1000, 10000);

  return `${random1}-${timestamp}-${random2}`;
};
