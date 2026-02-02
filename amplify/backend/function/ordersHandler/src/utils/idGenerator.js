const crypto = require("crypto");
/**
 * Generate a formatted order ID
 * @returns {string} Formatted order ID
 */
exports.generateFormattedOrderId = () => {
  // const timestamp = Date.now().toString().slice(-6); // last 6 digits
  // const random1 = crypto.randomInt(1000, 10000);
  // const random2 = crypto.randomInt(1000, 10000);

  // return `${random1}-${timestamp}-${random2}`;
  const now = new Date();

  const date =
    now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, "0") + String(now.getDate()).padStart(2, "0");

  const time =
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0") +
    String(now.getMilliseconds()).padStart(3, "0");

  const random = Math.random().toString(36).substring(2, 6).toUpperCase();

  return `${date}-${time}-${random}`;
};
