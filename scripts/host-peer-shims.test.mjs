import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkHostPeers, planHostPeers, resolveLauncherHost, writeHostPeers } from "./host-peer-shims.mjs";

function fixture(t, hoisted = false) {
	const temporaryRoot = process.env.PI_TEST_TMP_ROOT;
	const root = fs.mkdtempSync(path.join(temporaryRoot ?? os.tmpdir(), "peer-shims-test-"));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	const modules = path.join(root, "node_modules", "@earendil-works");
	const host = path.join(modules, "pi-coding-agent");
	const exports = {
		"pi-coding-agent": { ".": { import: "./dist/index.js" }, "./rpc-entry": { import: "./dist/bundle/rpc-entry.js" } },
		"pi-agent-core": { ".": { import: "./dist/index.js" } },
		"pi-ai": { ".": { import: "./dist/index.js" }, "./compat": { import: "./dist/compat.js" }, "./oauth": { import: "./dist/oauth.js" }, "./providers/*": { import: "./dist/providers/*.js" } },
		"pi-tui": undefined,
		chord: { ".": { source: "./src/index.ts", import: "./dist/index.js" }, "./context": { import: "./dist/context/index.js" } },
	};
	for (const [name, map] of Object.entries(exports)) {
		const packageRoot = name === "pi-coding-agent" || hoisted ? path.join(modules, name) : path.join(host, "node_modules", "@earendil-works", name);
		fs.mkdirSync(packageRoot, { recursive: true });
		fs.writeFileSync(path.join(packageRoot, "package.json"), JSON.stringify({ name: `@earendil-works/${name}`, version: "1.1.0-fork.1", bin: name === "pi-coding-agent" ? { pi: "dist/bundle/cli.js" } : undefined, main: "dist/index.js", exports: map }));
		for (const file of ["index.js", "compat.js", "oauth.js", "bundle/rpc-entry.js", "providers/all.js", "context/index.js", "bundle/cli.js"]) {
			const target = path.join(packageRoot, "dist", file);
			fs.mkdirSync(path.dirname(target), { recursive: true });
			fs.writeFileSync(target, "export const VERSION = '1.1.0-fork.1';\n");
		}
	}
	return { root, host, out: path.join(root, "shims") };
}

test("resolves a symlinked launcher and hoisted peers", (t) => {
	const f = fixture(t, true);
	const bin = path.join(f.root, "pi");
	fs.symlinkSync(path.join(f.host, "dist/bundle/cli.js"), bin);
	assert.equal(resolveLauncherHost(bin), fs.realpathSync(f.host));
	const plan = planHostPeers(f.host);
	assert.equal(plan.version, "1.1.0-fork.1");
	assert.equal(plan.packages.length, 5);
	assert.match(plan.packages.find((p) => p.folder === "pi-ai").files["index.js"], /compat\.js/);
});

test("writes and checks nested host peers without a removed core/node export", (t) => {
	const f = fixture(t);
	const plan = planHostPeers(f.host);
	writeHostPeers(plan, f.out);
	checkHostPeers(plan, f.out);
	assert.equal(fs.existsSync(path.join(f.out, "pi-agent-core/node.js")), false);
	assert.throws(() => writeHostPeers(plan, f.out), /already exists/);
});

test("detects stale wrapper paths and manifest versions", (t) => {
	const f = fixture(t);
	const plan = planHostPeers(f.host);
	writeHostPeers(plan, f.out);
	fs.writeFileSync(path.join(f.out, "pi-ai/index.js"), "export * from '/old/host.js';\n");
	assert.throws(() => checkHostPeers(plan, f.out), /Stale/);
});

test("rejects unknown hosts and arbitrary prereleases", (t) => {
	const f = fixture(t);
	const target = path.join(f.host, "package.json");
	const pkg = JSON.parse(fs.readFileSync(target, "utf8"));
	for (const version of ["1.1.0-beta.1", "01.1.0-fork.1", "1.01.0-fork.1", "1.1.00-fork.1", "1.1.0-fork.01"]) {
		fs.writeFileSync(target, JSON.stringify({ ...pkg, version }));
		assert.throws(() => planHostPeers(f.host), /identified stable/);
	}
	fs.writeFileSync(target, JSON.stringify({ ...pkg, name: "fake" }));
	assert.throws(() => planHostPeers(f.host), /identified stable/);
});

test("rejects missing and mismatched host peers", (t) => {
	const f = fixture(t, true);
	const peer = path.join(f.root, "node_modules/@earendil-works/pi-ai/package.json");
	const pkg = JSON.parse(fs.readFileSync(peer, "utf8"));
	fs.writeFileSync(peer, JSON.stringify({ ...pkg, version: "1.0.4" }));
	assert.throws(() => planHostPeers(f.host), /Peer version differs/);
	fs.unlinkSync(peer);
	assert.throws(() => planHostPeers(f.host), /Missing host peer/);
});

test("rejects a generated shim tree as the host in standard node_modules layout", (t) => {
	const f = fixture(t);
	const out = path.join(f.root, "consumer/node_modules/@earendil-works");
	writeHostPeers(planHostPeers(f.host), out);
	assert.throws(() => planHostPeers(path.join(out, "pi-coding-agent")), /shims cannot/);
});

test("requires a real bin.pi and verifies the selected launcher identity", (t) => {
	const f = fixture(t);
	const file = path.join(f.host, "package.json");
	const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
	fs.writeFileSync(file, JSON.stringify({ ...pkg, bin: undefined }));
	assert.throws(() => planHostPeers(f.host), /bin.pi/);
	fs.writeFileSync(file, JSON.stringify(pkg));
	assert.throws(() => resolveLauncherHost(path.join(f.host, "dist/index.js")), /differs/);
});

test("exclusive output creation rejects existing directories and symlinks", (t) => {
	const f = fixture(t);
	const plan = planHostPeers(f.host);
	fs.mkdirSync(f.out);
	assert.throws(() => writeHostPeers(plan, f.out), /already exists/);
	const linked = path.join(f.root, "linked-output");
	try {
		fs.symlinkSync(f.out, linked, "dir");
	} catch {
		t.skip("symlink support unavailable");
		return;
	}
	assert.throws(() => writeHostPeers(plan, linked), /already exists/);
	assert.deepEqual(fs.readdirSync(f.out), []);
});

test("rejects an output directory claimed immediately before exclusive creation", (t) => {
	const f = fixture(t);
	const plan = planHostPeers(f.host);
	const mkdir = fs.mkdirSync;
	t.mock.method(fs, "mkdirSync", (directory, options) => {
		if (directory === f.out) {
			assert.equal(options.recursive, undefined);
			mkdir(f.out);
		}
		return mkdir(directory, options);
	});
	assert.throws(() => writeHostPeers(plan, f.out), /already exists/);
	assert.deepEqual(fs.readdirSync(f.out), []);
});

test("rejects runtime exports outside their owner package", (t) => {
	const f = fixture(t);
	const pkg = JSON.parse(fs.readFileSync(path.join(f.host, "package.json"), "utf8"));
	fs.writeFileSync(path.join(f.root, "escape.js"), "export {};\n");
	pkg.exports["."].import = path.relative(f.host, path.join(f.root, "escape.js"));
	fs.writeFileSync(path.join(f.host, "package.json"), JSON.stringify(pkg));
	assert.throws(() => planHostPeers(f.host), /escapes package/);
});
