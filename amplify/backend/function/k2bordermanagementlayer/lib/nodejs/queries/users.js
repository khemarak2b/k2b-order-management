/**
 * Map Cognito sub to database user ID
 * Checks both users and admin_users tables
 * @param {Pool} pool - Database connection pool
 * @param {string} cognitoSub - Cognito user ID (sub claim)
 * @returns {Promise<number>} Database user ID
 */
async function getUserIdByCognitoSub(pool, cognitoSub) {
  const client = await pool.connect();
  try {
    const schema = process.env.ENVIRONMENT || "dev";
    
    // Check regular users table first
    const userResult = await client.query(
      `SELECT id FROM ${schema}.users WHERE cognito_sub = $1`,
      [cognitoSub]
    );

    if (userResult.rows.length > 0) {
      return userResult.rows[0].id;
    }

    // Fall back to admin_users table
    const adminResult = await client.query(
      `SELECT id FROM ${schema}.admin_users WHERE cognito_sub = $1`,
      [cognitoSub]
    );

    if (adminResult.rows.length > 0) {
      return adminResult.rows[0].id;
    }

    throw new Error(`User not found for Cognito sub: ${cognitoSub}`);
  } finally {
    client.release();
  }
}

module.exports = {
  getUserIdByCognitoSub,
};
