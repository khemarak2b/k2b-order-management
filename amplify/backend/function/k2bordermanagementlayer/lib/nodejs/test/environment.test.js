const assert = require("node:assert/strict");
const test = require("node:test");
const { requireEnvironment } = require("../utils/environment");

test("dev and prod are accepted", () => {
  assert.equal(requireEnvironment({ ENVIRONMENT: "dev" }), "dev");
  assert.equal(requireEnvironment({ ENVIRONMENT: "prod" }), "prod");
});

test("a missing or unexpected value stops instead of defaulting to dev", () => {
  for (const ENVIRONMENT of [undefined, "", "Dev", "staging", "prod; DROP TABLE x", " prod"]) {
    assert.throws(() => requireEnvironment({ ENVIRONMENT }), /ENVIRONMENT must be one of dev, prod/, String(ENVIRONMENT));
  }
});
