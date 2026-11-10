const assert = require("node:assert/strict");
const test = require("node:test");
const createRequest = require("serverless-http/lib/provider/aws/create-request");
const { extractAndInjectCognitoAuth } = require("../utils/cognitoExtractor");

const REAL = "cognito-idp.ap-southeast-2.amazonaws.com/pool,cognito-idp.ap-southeast-2.amazonaws.com/pool:CognitoSignIn:real-sub";
const FORGED = "cognito-idp.x/pool,cognito-idp.x/pool:CognitoSignIn:admin-sub";

// Builds the request Express would see, the same way serverless-http does.
const expressHeaders = (event) => createRequest(event, {}, {}).headers;

const event = (identity, clientHeaders) => ({
  httpMethod: "GET",
  path: "/orders",
  body: "",
  requestContext: { requestId: "r-1", identity: { sourceIp: "1.2.3.4", ...identity } },
  headers: { ...clientHeaders },
  multiValueHeaders: Object.fromEntries(Object.entries(clientHeaders).map(([k, v]) => [k, [v]])),
});

test("a forged identity header is dropped when API Gateway supplies no identity", () => {
  for (const name of ["x-cognito-authentication-provider", "X-Cognito-Authentication-Provider", "X-COGNITO-AUTHENTICATION-PROVIDER"]) {
    const e = event({}, { [name]: FORGED });
    extractAndInjectCognitoAuth(e, "r-1");
    assert.equal(expressHeaders(e)["x-cognito-authentication-provider"], undefined, name);
  }
});

test("a forged identity header only in multiValueHeaders is dropped", () => {
  const e = event({}, {});
  e.multiValueHeaders["X-Cognito-Authentication-Provider"] = [FORGED];
  extractAndInjectCognitoAuth(e, "r-1");
  assert.equal(expressHeaders(e)["x-cognito-authentication-provider"], undefined);
});

test("the verified identity replaces a forged one", () => {
  const e = event({ cognitoAuthenticationProvider: REAL }, { "X-Cognito-Authentication-Provider": FORGED });
  extractAndInjectCognitoAuth(e, "r-1");
  assert.equal(expressHeaders(e)["x-cognito-authentication-provider"], REAL);
});

test("an event with no requestContext is left without an identity", () => {
  const e = { headers: { "x-cognito-authentication-provider": FORGED } };
  extractAndInjectCognitoAuth(e, "r-1");
  assert.deepEqual(e.headers, {});
});
