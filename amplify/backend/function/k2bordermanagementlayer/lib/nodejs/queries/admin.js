/**
 * Map Cognito sub to admin user ID
 * @param {Pool} pool - Database connection pool
 * @param {string} cognitoSub - Cognito user ID (sub claim)
 * @returns {Promise<Object>} Admin user { id, role }
 */
async function getAdminUserByCognitoSub(pool, cognitoSub) {
  const client = await pool.connect();
  try {
    const schema = process.env.ENVIRONMENT || "dev";
    
    const result = await client.query(
      `SELECT id, role FROM ${schema}.admin_users WHERE cognito_sub = $1`,
      [cognitoSub]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } finally {
    client.release();
  }
}

module.exports = {
  getAdminUserByCognitoSub,
};
