import test from "node:test";
import assert from "node:assert/strict";
import { parseTakeoutBlockedAddressesJson } from "./takeout-blocked-addresses";

test("parseTakeoutBlockedAddressesJson normalizes, validates, and deduplicates addresses", () => {
  const parsed = parseTakeoutBlockedAddressesJson(JSON.stringify({
    addresses: [
      "User@One.Example",
      " user@one.example ",
      "not-an-email",
      "",
      "Another.User@example.org",
    ],
  }));

  assert.deepEqual(parsed, [
    "another.user@example.org",
    "user@one.example",
  ]);
});
