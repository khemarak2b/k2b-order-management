/**
 * The deployment environment, which is also the Postgres schema every query
 * uses (`${schema}.orders`). Dev and prod share a database (D0.3), so a missing
 * value must stop the Lambda rather than quietly fall back to the dev schema.
 *
 * Handlers call requireEnvironment() when index.js loads, so a misconfigured
 * Lambda fails at cold start instead of on its first query.
 */

const ALLOWED_ENVIRONMENTS = ["dev", "prod"];

function requireEnvironment(env = process.env) {
  const value = env.ENVIRONMENT;
  if (!ALLOWED_ENVIRONMENTS.includes(value)) {
    throw new Error(
      `ENVIRONMENT must be one of ${ALLOWED_ENVIRONMENTS.join(", ")}; got ${value === undefined ? "nothing" : JSON.stringify(value)}`,
    );
  }
  return value;
}

module.exports = { requireEnvironment, ALLOWED_ENVIRONMENTS };
