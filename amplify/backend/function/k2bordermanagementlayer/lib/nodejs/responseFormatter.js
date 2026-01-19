const _ = require("lodash");

/**
 * Convert snake_case keys to camelCase
 * Handles nested objects and arrays recursively
 */
const convertToCamelCase = (data) => {
  if (Array.isArray(data)) {
    return data.map((item) => convertToCamelCase(item));
  }

  if (data instanceof Date) {
    return data.toISOString();
  }

  if (data !== null && typeof data === "object") {
    const camelCased = {};
    for (const [key, value] of Object.entries(data)) {
      camelCased[_.camelCase(key)] = convertToCamelCase(value);
    }
    return camelCased;
  }

  return data;
};

/**
 * Format database response to camelCase for API consumption
 */
const formatResponse = (data) => {
  return convertToCamelCase(data);
};

module.exports = {
  convertToCamelCase,
  formatResponse,
};
