/**
 * Cognito authentication extraction from Lambda event
 * Extracts Cognito auth info and injects as headers for Express middleware
 */

/**
 * Extract user sub from Cognito authentication provider string
 * Format: "cognito-idp.ap-southeast-2.amazonaws.com/ap-southeast-2_THC7OTTv7,cognito-idp.ap-southeast-2.amazonaws.com/ap-southeast-2_THC7OTTv7:CognitoSignIn:298ed488-c021-7077-7758-b745081d2eed"
 */
function extractUserSubFromAuthProvider(authProvider) {
  if (!authProvider) return null;
  const parts = authProvider.split(":");
  if (parts.length >= 3) {
    return parts[parts.length - 1];
  }
  return null;
}

/**
 * Extract and inject Cognito auth info from Lambda event
 * @param {Object} event - Lambda event
 * @param {string} requestId - AWS Request ID for logging
 * @returns {Object} Modified event with Cognito headers injected
 */
function extractAndInjectCognitoAuth(event, requestId) {
  if (!event.requestContext || !event.requestContext.identity) {
    console.warn(`[${requestId}] No Cognito auth in request`);
    return event;
  }

  const cognitoAuthProvider = event.requestContext.identity.cognitoAuthenticationProvider;

  if (!cognitoAuthProvider) {
    console.warn(`[${requestId}] No Cognito auth provider found`);
    return event;
  }

  // Inject as custom header so Express middleware can access it
  event.headers = event.headers || {};
  event.headers["x-cognito-authentication-provider"] = cognitoAuthProvider;

  return event;
}

module.exports = {
  extractAndInjectCognitoAuth,
  extractUserSubFromAuthProvider,
};
