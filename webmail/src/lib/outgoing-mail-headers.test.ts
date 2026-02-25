import test from "node:test";
import assert from "node:assert/strict";
import { buildListUnsubscribeHeaders } from "./outgoing-mail-headers";

test("buildListUnsubscribeHeaders returns RFC-style list unsubscribe headers", () => {
  const headers = buildListUnsubscribeHeaders("admin@inout.email");

  assert.equal(headers["List-Unsubscribe"], "<mailto:admin@inout.email?subject=unsubscribe>");
  assert.equal(headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
});

test("buildListUnsubscribeHeaders sanitizes unsafe characters from mailbox value", () => {
  const headers = buildListUnsubscribeHeaders("admin@inout.email>\r\nBcc:evil@example.com");

  assert.equal(headers["List-Unsubscribe"], "<mailto:admin@inout.emailBcc:evil@example.com?subject=unsubscribe>");
});
