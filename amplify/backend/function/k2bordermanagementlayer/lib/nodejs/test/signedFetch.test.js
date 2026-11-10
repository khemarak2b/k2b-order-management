const assert = require("node:assert/strict");
const test = require("node:test");
const { signedFetch } = require("../utils/signedFetch");

const credentials = { accessKeyId: "AKIDEXAMPLE", secretAccessKey: "secret", sessionToken: "session-token" };

test("signs an execute-api request with the caller's credentials", async () => {
  let sent;
  const fetchImpl = async (url, init) => {
    sent = { url, init };
    return { ok: true };
  };
  const body = JSON.stringify({ to: "a@example.com", subject: "Hi", template: "order-received" });

  await signedFetch(
    "https://abc123.execute-api.ap-southeast-2.amazonaws.com/dev/email",
    { method: "POST", headers: { "Content-Type": "application/json" }, body },
    { credentials, region: "ap-southeast-2", fetchImpl },
  );

  const headers = sent.init.headers;
  assert.equal(sent.url, "https://abc123.execute-api.ap-southeast-2.amazonaws.com/dev/email");
  assert.equal(sent.init.method, "POST");
  assert.equal(sent.init.body, body);
  assert.match(headers.authorization, /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/ap-southeast-2\/execute-api\/aws4_request/);
  assert.match(headers.authorization, /SignedHeaders=[^,]*host/);
  assert.equal(headers["x-amz-security-token"], "session-token");
  assert.ok(headers["x-amz-date"]);
  assert.equal(headers["Content-Type"] ?? headers["content-type"], "application/json");
  assert.equal(headers.host, undefined);
});

test("uses the Lambda role's environment credentials by default", async () => {
  const saved = { ...process.env };
  Object.assign(process.env, {
    AWS_ACCESS_KEY_ID: "AKIDLAMBDA",
    AWS_SECRET_ACCESS_KEY: "lambda-secret",
    AWS_SESSION_TOKEN: "lambda-token",
    AWS_REGION: "ap-southeast-2",
  });
  try {
    let headers;
    await signedFetch("https://abc123.execute-api.ap-southeast-2.amazonaws.com/prod/email", { method: "POST", body: "{}" }, {
      fetchImpl: async (url, init) => {
        headers = init.headers;
        return { ok: true };
      },
    });
    assert.match(headers.authorization, /Credential=AKIDLAMBDA\//);
    assert.equal(headers["x-amz-security-token"], "lambda-token");
  } finally {
    process.env = saved;
  }
});
