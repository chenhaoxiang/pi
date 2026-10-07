import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { SandboxManager } from "@anthropic-ai/sandbox-runtime";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const sandboxRequire = createRequire(require.resolve("@anthropic-ai/sandbox-runtime"));
const shellQuote = sandboxRequire("shell-quote");
const agentRequire = createRequire(join(root, "packages/coding-agent/package.json"));
const vitestRequire = createRequire(agentRequire.resolve("vitest/package.json"));
const viteRequire = createRequire(vitestRequire.resolve("vite/package.json"));
const postcssRequire = createRequire(viteRequire.resolve("postcss/package.json"));
const sourceMapPath = postcssRequire.resolve("source-map-js");
const { SourceMapConsumer, SourceMapGenerator, SourceNode } = postcssRequire("source-map-js");
const shxManifestPath = require.resolve("shx/package.json");
const shxManifest = JSON.parse(readFileSync(shxManifestPath, "utf8"));
const shxCli = resolve(dirname(shxManifestPath), shxManifest.bin.shx);

function fixture(t) {
	const parent = join(root, "tmp", "dependency-security");
	mkdirSync(parent, { recursive: true });
	const directory = mkdtempSync(join(parent, "fixture-"));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	return directory;
}

function childEnv(directory) {
	return { PATH: process.env.PATH, HOME: directory, TMPDIR: directory, TMP: directory, TEMP: directory };
}

// GHSA-pqg4-j6r4-53mv: never execute the vulnerable quote output, even in a fixture.
for (const terminator of ["\n", "\r", "\u2028", "\u2029"]) {
	test(`sandbox shell-quote rejects a line terminator after a comment (${JSON.stringify(terminator)})`, () => {
		assert.throws(() => shellQuote.quote(["echo", "ok", { comment: "x" }, `a${terminator}printf injected;#`]), TypeError);
	});
}

// The security fix must still quote literal multiline shell arguments without a comment.
test("sandbox shell-quote preserves ordinary arguments and shell metacharacters", (t) => {
	const values = ["", "two words", "a\nb", "a\rb", "http://example.invalid/#fragment", "$(printf unexpected)", "a'b!", "*.json"];
	const parsed = shellQuote.parse(shellQuote.quote(values));
	assert.deepEqual(parsed.slice(0, -1), values.slice(0, -1));
	assert.deepEqual(parsed.at(-1), { op: "glob", pattern: "*.json" });
	if (process.platform !== "win32") {
		const directory = fixture(t);
		const result = spawnSync("/bin/sh", ["-c", `printf '%s\\0' ${shellQuote.quote(values)}`], {
			cwd: directory,
			env: childEnv(directory),
			encoding: "utf8",
			timeout: 2000,
		});
		assert.ifError(result.error);
		assert.equal(result.status, 0, result.stderr);
		assert.deepEqual(result.stdout.split("\0").slice(0, -1), values);
	}
});

test("sandbox configuration API retains filesystem and network restrictions", () => {
	const config = {
		network: { allowedDomains: [], deniedDomains: ["example.invalid"] },
		filesystem: { denyRead: ["/fixture-secret"], allowWrite: ["/fixture-work"], denyWrite: ["/fixture-work/secret"] },
	};
	const previous = SandboxManager.getConfig();
	try {
		SandboxManager.updateConfig(config);
		assert.deepEqual(SandboxManager.getFsReadConfig(), { denyOnly: config.filesystem.denyRead });
		const writes = SandboxManager.getFsWriteConfig();
		assert.ok(writes.allowOnly.includes("/fixture-work"));
		assert.deepEqual(writes.denyWithinAllow, config.filesystem.denyWrite);
		assert.deepEqual(SandboxManager.getNetworkRestrictionConfig(), { deniedHosts: ["example.invalid"] });
		assert.deepEqual(config.filesystem.denyRead, ["/fixture-secret"]);
	} finally {
		if (previous) SandboxManager.updateConfig(previous);
	}
});

// GHSA-68fv-2mgg-jv7q: bounded children prevent pre-fix busy loops from blocking the test runner.
for (const [line, expected] of [[1e12, "rejected\n"], [1e7, "generated\n"]]) {
	test(`PostCSS source-map consumer bounds an indexed offset (${line})`, (t) => {
		const directory = fixture(t);
		const indexedMap = {
			version: 3,
			sections: [{ offset: { line, column: 0 }, map: { version: 3, sources: ["source.js"], sourcesContent: ["original\n"], names: [], mappings: "AAAA" } }],
		};
		const code = `const { SourceMapConsumer, SourceNode } = require(process.argv[1]);
try {
	const consumer = new SourceMapConsumer(JSON.parse(process.argv[2]));
	process.stdout.write(SourceNode.fromStringWithSourceMap("generated\\n", consumer).toString());
} catch (error) {
	if (!(error instanceof Error) || !/^Section offset line must not exceed /.test(error.message)) throw error;
	process.stdout.write("rejected\\n");
}`;
		const result = spawnSync(process.execPath, ["--max-old-space-size=64", "-e", code, sourceMapPath, JSON.stringify(indexedMap)], {
			cwd: directory,
			env: childEnv(directory),
			encoding: "utf8",
			timeout: 2000,
			killSignal: "SIGKILL",
			maxBuffer: 64 * 1024,
		});
		assert.ifError(result.error);
		assert.equal(result.status, 0, result.stderr);
		assert.equal(result.stdout, expected);
	});
}

test("PostCSS source-map consumer preserves normal generated code and source mappings", () => {
	const generator = new SourceMapGenerator({ file: "output.js" });
	generator.addMapping({ generated: { line: 1, column: 0 }, original: { line: 2, column: 3 }, source: "source.js" });
	generator.setSourceContent("source.js", "first\n   original\n");
	const node = SourceNode.fromStringWithSourceMap("generated\n", new SourceMapConsumer(generator.toJSON()));
	const result = node.toStringWithSourceMap({ file: "output.js" });
	assert.equal(result.code, "generated\n");
	const consumer = new SourceMapConsumer(result.map.toJSON());
	assert.deepEqual(consumer.originalPositionFor({ line: 1, column: 0 }), { source: "source.js", line: 2, column: 3, name: null });
	assert.equal(consumer.sourceContentFor("source.js"), "first\n   original\n");
});

test("shx retains mkdir, recursive copy, globbed assets, chmod and recursive clean", (t) => {
	const directory = fixture(t);
	function shx(...args) {
		const result = spawnSync(process.execPath, [shxCli, ...args], { cwd: directory, env: childEnv(directory), encoding: "utf8", timeout: 5000 });
		assert.ifError(result.error);
		assert.equal(result.status, 0, result.stderr);
	}
	shx("mkdir", "-p", "source assets/nested", "output assets", "copied tree");
	writeFileSync(join(directory, "source assets", "one.json"), "one");
	writeFileSync(join(directory, "source assets", "two.json"), "two");
	writeFileSync(join(directory, "source assets", "ignored.txt"), "ignored");
	writeFileSync(join(directory, "source assets", "nested", "file.txt"), "nested");
	shx("cp", "source assets/*.json", "output assets/");
	assert.equal(readFileSync(join(directory, "output assets", "one.json"), "utf8"), "one");
	assert.equal(readFileSync(join(directory, "output assets", "two.json"), "utf8"), "two");
	assert.throws(() => statSync(join(directory, "output assets", "ignored.txt")), { code: "ENOENT" });
	shx("cp", "-r", "source assets/nested", "copied tree/");
	assert.equal(readFileSync(join(directory, "copied tree", "nested", "file.txt"), "utf8"), "nested");
	shx("chmod", "+x", "output assets/one.json");
	if (process.platform !== "win32") assert.notEqual(statSync(join(directory, "output assets", "one.json")).mode & 0o111, 0);
	shx("rm", "-rf", "output assets", "copied tree", "nonexistent");
	assert.throws(() => statSync(join(directory, "output assets")), { code: "ENOENT" });
});

test("dependency lock excludes the braces chain and pins the corrected consumers", () => {
	const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
	assert.equal(lock.packages["node_modules/shell-quote"].version, "1.12.0");
	assert.equal(lock.packages["node_modules/source-map-js"].version, "1.2.2");
	assert.equal(sandboxRequire("shell-quote/package.json").version, "1.12.0");
	assert.equal(postcssRequire("source-map-js/package.json").version, "1.2.2");
	for (const name of ["braces", "micromatch", "fast-glob"]) {
		assert.equal(Object.keys(lock.packages).some((key) => key === `node_modules/${name}` || key.endsWith(`/node_modules/${name}`)), false);
	}
	for (const pkg of Object.values(lock.packages)) {
		if (pkg.devDependencies?.shx) assert.equal(pkg.devDependencies.shx, "0.3.4");
	}
	assert.equal(shxManifest.version, "0.3.4");
	const sandbox = JSON.parse(readFileSync(join(root, "packages/coding-agent/examples/extensions/sandbox/package.json"), "utf8"));
	assert.equal(sandbox.overrides["shell-quote"], "1.12.0");
});
