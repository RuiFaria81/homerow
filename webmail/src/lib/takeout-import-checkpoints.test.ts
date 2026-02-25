import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  checkpointIdsPathForArchive,
  checkpointMetaPathForArchive,
  getTakeoutCheckpointDir,
} from "./takeout-import-checkpoints.ts";

test("checkpoint paths default to dedicated temp checkpoint directory", () => {
  const previous = process.env.TAKEOUT_IMPORT_CHECKPOINT_DIR;
  delete process.env.TAKEOUT_IMPORT_CHECKPOINT_DIR;
  try {
    const dir = getTakeoutCheckpointDir();
    assert.equal(dir, path.join(tmpdir(), "webmail-takeout-checkpoints"));

    const meta = checkpointMetaPathForArchive("/var/lib/custom-webmail/takeout-imports/takeout-001.tgz");
    const ids = checkpointIdsPathForArchive("/var/lib/custom-webmail/takeout-imports/takeout-001.tgz");
    assert.equal(meta.startsWith(dir), true);
    assert.equal(ids.startsWith(dir), true);
    assert.equal(meta.endsWith(".json"), true);
    assert.equal(ids.endsWith(".ids"), true);
  } finally {
    if (previous !== undefined) process.env.TAKEOUT_IMPORT_CHECKPOINT_DIR = previous;
  }
});

test("checkpoint paths are unique for different archive paths with same filename", () => {
  const a = checkpointMetaPathForArchive("/tmp/a/takeout-001.tgz");
  const b = checkpointMetaPathForArchive("/tmp/b/takeout-001.tgz");
  assert.notEqual(a, b);
});

