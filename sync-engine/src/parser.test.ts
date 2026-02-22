import test from "node:test";
import assert from "node:assert/strict";
import { parseEmail } from "./parser.js";

test("parseEmail extracts rspamd score from X-Spamd-Result", async () => {
  const raw = Buffer.from(
    [
      "From: sender@example.com",
      "To: admin@inout.email",
      "Subject: Rspamd score header",
      "Date: Fri, 20 Feb 2026 10:00:00 +0000",
      "Message-Id: <rspamd-score@example.com>",
      "X-Spamd-Result: default: False [5.70 / 15.00]",
      "",
      "Hello world",
      "",
    ].join("\r\n"),
    "utf8",
  );

  const parsed = await parseEmail(raw);
  assert.equal(parsed.spamScore, 5.7);
});

test("parseEmail falls back to X-Spam-Score", async () => {
  const raw = Buffer.from(
    [
      "From: sender@example.com",
      "To: admin@inout.email",
      "Subject: Spam score header",
      "Date: Fri, 20 Feb 2026 10:05:00 +0000",
      "Message-Id: <spam-score@example.com>",
      "X-Spam-Score: 2.3",
      "",
      "Hello world",
      "",
    ].join("\r\n"),
    "utf8",
  );

  const parsed = await parseEmail(raw);
  assert.equal(parsed.spamScore, 2.3);
});
