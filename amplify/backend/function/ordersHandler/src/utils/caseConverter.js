/**
 * Convert camelCase keys to snake_case
 */
function toSnakeCase(obj) {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }
    
    const converted = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            converted[snakeKey] = obj[key];
        }
    }
    return converted;
}

/**
 * Convert snake_case keys to camelCase
 */
function toCamelCase(str) {
    return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
}

module.exports = {
    toSnakeCase,
    toCamelCase
};
