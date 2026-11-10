/**
 * fetch() signed with SigV4 for API Gateway paths that use AWS_IAM auth, such
 * as the notification API's POST /email.
 *
 * Credentials come from the Lambda execution role (the AWS_* environment
 * variables Lambda sets), so the caller's role needs execute-api:Invoke on the
 * target path.
 */
const { SignatureV4 } = require("@smithy/signature-v4");
const { Sha256 } = require("@aws-crypto/sha256-js");

const lambdaCredentials = () => ({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  sessionToken: process.env.AWS_SESSION_TOKEN,
});

/**
 * @param {string} url Full URL, including the stage, e.g. https://abc.execute-api.ap-southeast-2.amazonaws.com/dev/email
 * @param {{ method?: string, headers?: Record<string, string>, body?: string }} [init]
 * @param {{ credentials?: object, region?: string, fetchImpl?: typeof fetch }} [options]
 */
async function signedFetch(url, init = {}, options = {}) {
  const { method = "GET", headers = {}, body } = init;
  const { credentials = lambdaCredentials(), region = process.env.AWS_REGION, fetchImpl = fetch } = options;
  const target = new URL(url);

  const signer = new SignatureV4({ service: "execute-api", region, credentials, sha256: Sha256 });
  const signed = await signer.sign({
    method,
    protocol: target.protocol,
    hostname: target.hostname,
    path: target.pathname,
    query: Object.fromEntries(target.searchParams),
    headers: { ...headers, host: target.hostname },
    body,
  });

  // fetch sets Host itself, and it matches the signed value.
  const { host, ...signedHeaders } = signed.headers;
  return fetchImpl(url, { method, headers: signedHeaders, body });
}

module.exports = { signedFetch };
