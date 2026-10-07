import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const internal = (name) => name?.startsWith("@earendil-works/pi-") || name === "@earendil-works/chord";

function fixture(version, repository) {
	const directory = mkdtempSync(join(tmpdir(), "pi-fork-install-lock-"));
	const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
	for (const [path, entry] of Object.entries(lock.packages)) {
		if (!path.startsWith("packages/") || path.includes("/node_modules/") || !entry.name) continue;
		const pkg = JSON.parse(readFileSync(join(root, path, "package.json"), "utf8"));
		if (internal(pkg.name)) pkg.version = entry.version = version;
		for (const section of ["dependencies", "devDependencies", "optionalDependencies"]) {
			for (const name of Object.keys(pkg[section] ?? {})) if (internal(name)) pkg[section][name] = `^${version}`;
			entry[section] = pkg[section];
		}
		if (pkg.name === "@earendil-works/pi-coding-agent") {
			if (repository === undefined) delete pkg.piConfig.forkRepository;
			else pkg.piConfig.forkRepository = repository;
		}
		mkdirSync(join(directory, path), { recursive: true });
		writeFileSync(join(directory, path, "package.json"), JSON.stringify(pkg));
	}
	mkdirSync(join(directory, "scripts"), { recursive: true });
	cpSync(join(root, "scripts/generate-coding-agent-install-lock.mjs"), join(directory, "scripts/generate-coding-agent-install-lock.mjs"));
	writeFileSync(join(directory, "package-lock.json"), JSON.stringify(lock));
	return directory;
}

for (const [version, repository, host] of [
	["1.0.4", undefined, "https://registry.npmjs.org/"],
	["1.0.4-fork.1", "chenhaoxiang/pi", "https://github.com/chenhaoxiang/pi/releases/download/v1.0.4-fork.1/"],
]) {
	test(`installer lock preserves the ${version} distribution source`, () => {
		const directory = fixture(version, repository);
		try {
			execFileSync(process.execPath, ["scripts/generate-coding-agent-install-lock.mjs"], { cwd: directory });
			execFileSync(process.execPath, ["scripts/generate-coding-agent-install-lock.mjs", "--check"], { cwd: directory });
			const lock = JSON.parse(readFileSync(join(directory, "packages/coding-agent/install-lock/package-lock.json"), "utf8"));
			const entries = Object.entries(lock.packages).filter(([path]) => /^node_modules\/@earendil-works\/(?:pi-[^/]+|chord)$/.test(path));
			assert.ok(entries.length > 1);
			for (const [path, entry] of entries) {
				assert.equal(entry.version, version);
				assert.ok(entry.resolved.startsWith(host), path);
			}
			assert.equal(lock.packages["node_modules/undici"].resolved, JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8")).packages["node_modules/undici"].resolved);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});
}

for (const [version, repository] of [["1.0.4-fork.0", "chenhaoxiang/pi"], ["1.0.4-fork.1", "../escape"], ["1.0.4-fork.1", "https://invalid.example/pi"]]) {
	test(`rejects invalid fork source ${version} ${repository}`, () => {
		const directory = fixture(version, repository);
		try {
			assert.throws(() => execFileSync(process.execPath, ["scripts/generate-coding-agent-install-lock.mjs"], { cwd: directory, stdio: "pipe" }), /Invalid fork repository or release version/);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});
}
