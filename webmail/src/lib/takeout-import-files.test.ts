import test from "node:test";
import assert from "node:assert/strict";
import { isTakeoutArchiveFilename, normalizeTakeoutServerFilename } from "./takeout-import-filenames.ts";

test("isTakeoutArchiveFilename accepts supported extensions case-insensitively", () => {
  assert.equal(isTakeoutArchiveFilename("my-export.tgz"), true);
  assert.equal(isTakeoutArchiveFilename("MY-EXPORT.TAR.GZ"), true);
  assert.equal(isTakeoutArchiveFilename(" mail.tar.gz "), true);
});

test("isTakeoutArchiveFilename rejects unsupported names", () => {
  assert.equal(isTakeoutArchiveFilename("archive.zip"), false);
  assert.equal(isTakeoutArchiveFilename("mail.mbox"), false);
  assert.equal(isTakeoutArchiveFilename(""), false);
});

test("normalizeTakeoutServerFilename strips directories", () => {
  assert.equal(normalizeTakeoutServerFilename("/var/lib/custom-webmail/takeout-imports/test.tgz"), "test.tgz");
  assert.equal(normalizeTakeoutServerFilename("../unsafe.tar.gz"), "unsafe.tar.gz");
});
