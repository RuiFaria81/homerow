import test from "node:test";
import assert from "node:assert/strict";
import {
  detectTakeoutMultipartSet,
  isTakeoutArchiveFilename,
  normalizeTakeoutServerFilename,
} from "./takeout-import-filenames.ts";

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

test("detectTakeoutMultipartSet returns sorted sibling parts for split archives", () => {
  const files = [
    "takeout-20260213T174547Z-3-002.tgz",
    "takeout-20260213T174547Z-3-001.tgz",
    "takeout-20260213T174547Z-3-003.tgz",
    "other-export-001.tgz",
  ];

  const matched = detectTakeoutMultipartSet("takeout-20260213T174547Z-3-001.tgz", files);
  assert.deepEqual(matched, [
    "takeout-20260213T174547Z-3-001.tgz",
    "takeout-20260213T174547Z-3-002.tgz",
    "takeout-20260213T174547Z-3-003.tgz",
  ]);
});

test("detectTakeoutMultipartSet falls back to selected file when no sibling parts exist", () => {
  const matched = detectTakeoutMultipartSet("single-export.tgz", [
    "single-export.tgz",
    "another.tgz",
  ]);
  assert.deepEqual(matched, ["single-export.tgz"]);
});
