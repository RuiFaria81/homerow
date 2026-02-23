import assert from "node:assert/strict";
import test from "node:test";
import { compareVersions, computeSeverity, getUpdateStatus, normalizeVersion } from "./update-status-server";

test("normalizeVersion accepts semver and applies v prefix", () => {
  assert.equal(normalizeVersion("1.2.3"), "v1.2.3");
  assert.equal(normalizeVersion("v2.3.4"), "v2.3.4");
  assert.equal(normalizeVersion("  v2.3.4-beta.1  "), "v2.3.4-beta.1");
  assert.equal(normalizeVersion("main"), null);
});

test("compareVersions compares semantic versions", () => {
  assert.ok(compareVersions("v1.2.3", "v1.2.2") > 0);
  assert.ok(compareVersions("v1.2.3", "v1.3.0") < 0);
  assert.equal(compareVersions("v1.2.3", "v1.2.3"), 0);
  assert.ok(compareVersions("v1.2.3", "v1.2.3-beta.1") > 0);
});

test("computeSeverity classifies patch/minor/major updates", () => {
  assert.equal(computeSeverity("v1.2.3", "v1.2.4"), "patch");
  assert.equal(computeSeverity("v1.2.3", "v1.3.0"), "minor");
  assert.equal(computeSeverity("v1.2.3", "v2.0.0"), "major");
  assert.equal(computeSeverity("v1.2.3", "v1.2.3"), "none");
  assert.equal(computeSeverity("unknown", "v1.2.3"), "unknown");
});

test("getUpdateStatus supports pinned mode for deterministic checks", async () => {
  const original = {
    HOMEROW_VERSION: process.env.HOMEROW_VERSION,
    UPDATE_MODE: process.env.UPDATE_MODE,
    UPDATE_TARGET: process.env.UPDATE_TARGET,
    UPDATE_CHECK_DISABLE_CACHE: process.env.UPDATE_CHECK_DISABLE_CACHE,
  };

  process.env.HOMEROW_VERSION = "v1.0.0";
  process.env.UPDATE_MODE = "pinned";
  process.env.UPDATE_TARGET = "v1.1.0";
  process.env.UPDATE_CHECK_DISABLE_CACHE = "1";

  try {
    const status = await getUpdateStatus({ force: true });
    assert.equal(status.updateAvailable, true);
    assert.equal(status.severity, "minor");
    assert.equal(status.sourceLabel, "Pinned");
    assert.equal(status.latest, "v1.1.0");
  } finally {
    process.env.HOMEROW_VERSION = original.HOMEROW_VERSION;
    process.env.UPDATE_MODE = original.UPDATE_MODE;
    process.env.UPDATE_TARGET = original.UPDATE_TARGET;
    process.env.UPDATE_CHECK_DISABLE_CACHE = original.UPDATE_CHECK_DISABLE_CACHE;
  }
});
