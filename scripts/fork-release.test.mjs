import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

for (const [name, args, expected] of [
	["requires a tested binary", ["--out", resolve(root, "tmp/fork-release-unused")], /requires a separately tested native binary/],
	["rejects unknown options", ["--out", resolve(root, "tmp/fork-release-unused"), "--unknown"], /Usage:/],
	["rejects checkout-local output", ["--out", resolve(root, "tmp/fork-release-unused"), "--candidate"], /new directory outside the source checkout/],
]) {
	test(`fork packer ${name} with the current upstream artifact helpers`, () => {
		const result = spawnSync(process.execPath, ["scripts/pack-fork-release.mjs", ...args], {
			cwd: root,
			encoding: "utf8",
			timeout: 30000,
		});
		assert.ifError(result.error);
		assert.equal(result.status, 1);
		assert.match(result.stderr, expected);
		assert.doesNotMatch(result.stderr, /ERR_MODULE_NOT_FOUND/);
	});
}
