/**
 * Role-based authorization middleware
 * Allows admins to bypass ownership checks, regular users can only access their own resources
 */

/**
 * Create role-aware ownership middleware
 * Admins bypass ownership checks
 */
function createRoleAwareOwnershipMiddleware(resourceFetcher, resourceOwnerField = "user_id") {
  return async (req, res, next) => {
    const requestId = req.get("x-amzn-trace-id") || "unknown";

    // Admins can access any resource
    if (req.user.isAdmin) {
      return next();
    }

    try {
      const resource = await resourceFetcher(req);

      if (!resource) {
        return res.status(404).json({ error: "Resource not found" });
      }

      if (String(resource[resourceOwnerField]) !== String(req.user.id)) {
        console.warn(
          `[${requestId}] Unauthorized: User ${req.user.id} attempted to access resource owned by ${resource[resourceOwnerField]}`
        );
        return res.status(403).json({ error: "You don't have permission to access this resource" });
      }

      // Attach resource to request for downstream use
      req.resource = resource;
      next();
    } catch (error) {
      console.error(`[${requestId}] Authorization error:`, error);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}

/**
 * Require admin access only
 */
function requireAdmin(req, res, next) {
  const requestId = req.get("x-amzn-trace-id") || "unknown";

  if (!req.user.isAdmin) {
    console.warn(`[${requestId}] Unauthorized: Non-admin user attempted admin action`);
    return res.status(403).json({ error: "Admin access required" });
  }

  next();
}

/**
 * Check if user is admin or accessing their own data
 */
function requireUserIdMatchOrAdmin(fieldGetter) {
  return (req, res, next) => {
    const requestId = req.get("x-amzn-trace-id") || "unknown";

    // Admins can access any user's data
    if (req.user.isAdmin) {
      return next();
    }

    const userId = fieldGetter(req);

    if (String(userId) !== String(req.user.id)) {
      console.warn(
        `[${requestId}] Unauthorized: User ${req.user.id} attempted to access user ${userId}'s data`
      );
      return res.status(403).json({ error: "You don't have permission to access this resource" });
    }

    next();
  };
}

module.exports = {
  createRoleAwareOwnershipMiddleware,
  requireAdmin,
  requireUserIdMatchOrAdmin,
};
