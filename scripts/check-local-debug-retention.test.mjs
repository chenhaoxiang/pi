import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { inspectDebugRetention } from "./check-local-debug-retention.mjs";

function fixture(t) {
	const root = fs.mkdtempSync(path.join(process.env.PI_TEST_TMP_ROOT ?? os.tmpdir(), "debug-retention-test-"));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	return root;
}

test("aggregates metadata and reports read-only capacity state", (t) => {
	const root = fixture(t);
	const nested = path.join(root, "nested");
	fs.mkdirSync(nested);
	const oldFile = path.join(root, "old.log");
	const newFile = path.join(nested, "new.log");
	fs.writeFileSync(oldFile, "old");
	fs.writeFileSync(newFile, "newer");
	const now = Date.parse("2026-10-10T00:00:00Z");
	fs.utimesSync(oldFile, new Date(now - 15 * 86400000), new Date(now - 15 * 86400000));
	fs.utimesSync(newFile, new Date(now), new Date(now));
	const result = inspectDebugRetention(root, { now, olderThanDays: 14, maxBytes: 7 });
	assert.deepEqual(
		{ files: result.files, bytes: result.bytes, oldFiles: result.oldFiles, oldBytes: result.oldBytes },
		{ files: 2, bytes: 8, oldFiles: 1, oldBytes: 3 },
	);
	assert.equal(result.exceedsCapacity, true);
	assert.equal(result.mode, "read-only");
	assert.equal(result.contentsRead, false);
	assert.equal(result.removed, 0);
});

test("does not follow symlinked children or accept a symlink root", (t) => {
	const root = fixture(t);
	const outside = fixture(t);
	fs.writeFileSync(path.join(outside, "outside.log"), "outside");
	try {
		fs.symlinkSync(outside, path.join(root, "linked"), "dir");
	} catch {
		t.skip("symlink support unavailable");
		return;
	}
	const result = inspectDebugRetention(root);
	assert.equal(result.files, 0);
	assert.equal(result.skippedSymlinks, 1);
	assert.throws(() => inspectDebugRetention(path.join(root, "linked")), /non-symlink/);
	assert.throws(() => inspectDebugRetention(path.join(root, "linked") + path.sep), /non-symlink/);
});

test("rejects invalid retention thresholds", (t) => {
	const root = fixture(t);
	assert.throws(() => inspectDebugRetention(root, { maxBytes: -1 }), /nonnegative/);
	assert.throws(() => inspectDebugRetention(root, { olderThanDays: -1 }), /nonnegative/);
	assert.throws(() => inspectDebugRetention(root, { maxBytes: 1.5 }), /safe integers/);
});
