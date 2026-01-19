const Snowflake = require('snowflake-id');

// Initialize Snowflake ID generator
// Epoch: Jan 1, 2020, Worker ID: 1, Datacenter ID: 1
const snowflake = new Snowflake({
  epoch: 1577836800000, // Jan 1, 2020 in milliseconds
  workerId: 1,
  datacenterId: 1,
});

/**
 * Generate a Snowflake ID for orders
 * @returns {string} Snowflake ID as string
 */
exports.generateOrderId = () => {
  return snowflake.generate().toString();
};

/**
 * Generate a formatted order ID (e.g., "ORD-1234567890123456789")
 * @returns {string} Formatted order ID
 */
exports.generateFormattedOrderId = () => {
  const id = snowflake.generate().toString();
  return `ORD-${id}`;
};
