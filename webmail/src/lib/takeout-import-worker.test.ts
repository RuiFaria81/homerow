import test from "node:test";
import assert from "node:assert/strict";
import { parseTakeoutBlockedAddressesJson } from "./takeout-blocked-addresses.ts";
import { stripNullBytes } from "./takeout-import-sanitize.ts";

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

test("stripNullBytes removes NUL characters from decoded content before DB insert", () => {
  const raw = "Subject\u0000 with\u0000 NUL";
  assert.equal(stripNullBytes(raw), "Subject with NUL");
});
