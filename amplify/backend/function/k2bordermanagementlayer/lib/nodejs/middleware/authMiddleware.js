/**
 * Auth Middleware - Extracts and validates Cognito user from API Gateway event
 * Attaches authenticated user to req.user for downstream use
 */

const { getUserIdByCognitoSub } = require("../queries/users");
const { getAdminUserByCognitoSub } = require("../queries/admin");

const authMiddleware = async (req, res, next) => {
  const requestId = req.get("x-amzn-trace-id") || "unknown";

  try {
    // Extract Cognito sub from requestContext (passed by serverless-http)
    // Format: "cognito-idp.{region}.amazonaws.com/{userPoolId},cognito-idp.{region}.amazonaws.com/{userPoolId}:CognitoSignIn:{sub}"
    const cognitoAuthProvider =
      req.get("x-cognito-authentication-provider") || req.cognitoAuthProvider || extractFromEvent(req);

    if (!cognitoAuthProvider) {
      console.warn(`[${requestId}] Missing authentication`);
      return res.status(401).json({ error: "Missing authentication" });
    }

    // Extract sub (user ID) from Cognito auth provider string
    const userSub = extractUserSubFromCognitoAuthProvider(cognitoAuthProvider);

    if (!userSub) {
      console.warn(`[${requestId}] Could not extract user sub`);
      return res.status(401).json({ error: "Invalid authentication" });
    }

    // Look up database user ID from Cognito sub
    let userId;
    let isAdmin = false;
    let adminUser = null;
    try {
      userId = await getUserIdByCognitoSub(req.pool, userSub);
      
      // Check if user is an admin
      adminUser = await getAdminUserByCognitoSub(req.pool, userSub);
      if (adminUser) {
        isAdmin = true;
      }
    } catch (error) {
      console.warn(`[${requestId}] User lookup failed:`, error.message);
      return res.status(401).json({ error: "User not found" });
    }

    // Attach to request for downstream use
    req.user = {
      sub: userSub,
      id: userId,
      cognitoAuthProvider,
      isAdmin,
      ...(adminUser
        ? {
            adminId: adminUser.id,
            role: adminUser.role,
            email: adminUser.email || "",
            name:
              [adminUser.first_name, adminUser.last_name]
                .filter(Boolean)
                .join(" ") || adminUser.email || "",
          }
        : {}),
    };

    next();
  } catch (error) {
    console.error(`[${requestId}] Auth error:`, error);
    res.status(401).json({ error: "Unauthorized" });
  }
};

/**
 * Extract user sub from Cognito authentication provider string
 * Format: "cognito-idp.ap-southeast-2.amazonaws.com/ap-southeast-2_THC7OTTv7,cognito-idp.ap-southeast-2.amazonaws.com/ap-southeast-2_THC7OTTv7:CognitoSignIn:298ed488-c021-7077-7758-b745081d2eed"
 */
function extractUserSubFromCognitoAuthProvider(authProvider) {
  if (!authProvider) return null;

  const parts = authProvider.split(":");
  if (parts.length >= 3) {
    return parts[parts.length - 1];
  }
  return null;
}

/**
 * Try to extract from Lambda event if serverless-http doesn't pass headers properly
 * This is a fallback mechanism
 */
function extractFromEvent(req) {
  // If you need direct access to the Lambda event, you'd need to pass it through serverless-http
  // For now, return null to fail gracefully
  return null;
}

module.exports = {
  authMiddleware,
};
