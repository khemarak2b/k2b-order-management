/**
 * Authorization middleware for checking resource ownership
 * Verifies that authenticated user owns the resource they're trying to access
 */

/**
 * Generic ownership check factory
 * Creates middleware to verify user owns a resource fetched from database
 */
function createOwnershipMiddleware(resourceFetcher, resourceOwnerField = "user_id") {
  return async (req, res, next) => {
    const requestId = req.get("x-amzn-trace-id") || "unknown";

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
 * Check if user's ID matches a param or body value
 */
function requireUserIdMatch(fieldGetter) {
  return (req, res, next) => {
    const requestId = req.get("x-amzn-trace-id") || "unknown";
    const userId = fieldGetter(req);

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

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
  createOwnershipMiddleware,
  requireUserIdMatch,
};
