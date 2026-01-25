/**
 * Map Cognito sub to database user ID
 * @param {Pool} pool - Database connection pool
 * @param {string} cognitoSub - Cognito user ID (sub claim)
 * @returns {Promise<number>} Database user ID
 */
async function getUserIdByCognitoSub(pool, cognitoSub) {
  const client = await pool.connect();
  try {
    const schema = process.env.ENVIRONMENT || "dev";
    
    const result = await client.query(
      `SELECT id FROM ${schema}.users WHERE cognito_sub = $1`,
      [cognitoSub]
    );

    if (result.rows.length === 0) {
      throw new Error(`User not found for Cognito sub: ${cognitoSub}`);
    }

    return result.rows[0].id;
  } finally {
    client.release();
  }
}

module.exports = {
  getUserIdByCognitoSub,
};
