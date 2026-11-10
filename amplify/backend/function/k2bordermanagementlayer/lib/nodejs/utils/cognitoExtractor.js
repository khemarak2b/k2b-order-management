/**
 * Cognito authentication extraction from Lambda event
 * Extracts Cognito auth info and injects as headers for Express middleware
 */

const AUTH_PROVIDER_HEADER = "x-cognito-authentication-provider";

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
  // Only API Gateway's verified identity may set this header. Remove any
  // client-sent copy, in any casing, from both header maps first:
  // serverless-http merges multiValueHeaders into the request.
  removeHeader(event, AUTH_PROVIDER_HEADER);

  const cognitoAuthProvider = event?.requestContext?.identity?.cognitoAuthenticationProvider;

  if (!cognitoAuthProvider) {
    console.warn(`[${requestId}] No Cognito auth provider found`);
    return event;
  }

  // Inject as custom header so Express middleware can access it
  event.headers = event.headers || {};
  event.headers[AUTH_PROVIDER_HEADER] = cognitoAuthProvider;

  return event;
}

function removeHeader(event, name) {
  for (const headers of [event?.headers, event?.multiValueHeaders]) {
    if (!headers) continue;
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === name) delete headers[key];
    }
  }
}

module.exports = {
  extractAndInjectCognitoAuth,
  extractUserSubFromAuthProvider,
};
