/**
 * Helpers for SQL that builds column names from an object's keys.
 *
 * Column names cannot be sent as query parameters, so a key taken from a
 * request body ends up as raw SQL. Every such query must either keep only
 * known columns (pickColumns) or at least refuse anything that is not a plain
 * column name (assertSafeColumns).
 */

const COLUMN_NAME = /^[a-z][a-z0-9_]{0,62}$/;

const invalidColumn = (column) =>
  Object.assign(new Error(`Invalid column name: ${String(column).slice(0, 40)}`), { status: 400 });

/** Throws unless every name is a plain lowercase SQL identifier. */
function assertSafeColumns(columns) {
  for (const column of columns) {
    if (typeof column !== "string" || !COLUMN_NAME.test(column)) throw invalidColumn(column);
  }
  return columns;
}

/** Returns a new object with only the allowed keys that have a defined value. */
function pickColumns(data, allowed) {
  const picked = {};
  for (const column of allowed) {
    if (data && Object.hasOwn(data, column) && data[column] !== undefined) picked[column] = data[column];
  }
  return picked;
}

module.exports = { assertSafeColumns, pickColumns };
