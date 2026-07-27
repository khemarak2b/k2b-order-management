/**
 * Admin authentication middleware
 * Validates admin user from separate admin Cognito user pool
 */

const { getAdminUserByCognitoSub } = require("../queries/admin");

/**
 * Admin auth middleware
 * Validates admin user and attaches admin info to req.user
 */
const adminAuthMiddleware = async (req, res, next) => {
  const requestId = req.get("x-amzn-trace-id") || "unknown";

  try {
    // Extract Cognito auth provider (same as regular auth)
    const cognitoAuthProvider =
      req.get("x-cognito-authentication-provider") || req.cognitoAuthProvider;

    if (!cognitoAuthProvider) {
      console.warn(`[${requestId}] Missing authentication`);
      return res.status(401).json({ error: "Missing authentication" });
    }

    // Extract sub from auth provider
    const userSub = extractUserSubFromCognitoAuthProvider(cognitoAuthProvider);

    if (!userSub) {
      console.warn(`[${requestId}] Could not extract user sub`);
      return res.status(401).json({ error: "Invalid authentication" });
    }

    // Look up admin user
    const adminUser = await getAdminUserByCognitoSub(req.pool, userSub);

    if (!adminUser) {
      console.warn(`[${requestId}] Admin user not found for sub: ${userSub}`);
      return res.status(403).json({ error: "Admin access denied" });
    }

    // Attach admin info to request
    req.user = {
      sub: userSub,
      isAdmin: true,
      adminId: adminUser.id,
      role: adminUser.role,
      email: adminUser.email || "",
      name:
        [adminUser.first_name, adminUser.last_name]
          .filter(Boolean)
          .join(" ") || adminUser.email || "",
      cognitoAuthProvider,
    };

    next();
  } catch (error) {
    console.error(`[${requestId}] Admin auth error:`, error);
    res.status(401).json({ error: "Unauthorized" });
  }
};

function extractUserSubFromCognitoAuthProvider(authProvider) {
  if (!authProvider) return null;
  const parts = authProvider.split(":");
  if (parts.length >= 3) {
    return parts[parts.length - 1];
  }
  return null;
}

module.exports = {
  adminAuthMiddleware,
};
