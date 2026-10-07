#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { installCodingAgentConsumer, packReleasePackages, smokeTestCodingAgentConsumer } from "./coding-agent-consumer.mjs";
import { getPublicWorkspacePackages } from "./release-packages.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const args = process.argv.slice(2);
const candidate = args.includes("--candidate");
const index = args.indexOf("--out");
if (index < 0 || !args[index + 1] || args.some((arg, i) => i !== index + 1 && !["--out", "--candidate"].includes(arg))) {
	throw new Error("Usage: node scripts/pack-fork-release.mjs --out <new external directory> [--candidate]");
}
const output = resolve(args[index + 1]);
const offset = relative(root, output);
if (!offset || (!offset.startsWith("..") && !isAbsolute(offset)) || existsSync(output)) {
	throw new Error("Output must be a new directory outside the source checkout");
}
const pkg = JSON.parse(readFileSync(join(root, "packages/coding-agent/package.json"), "utf8"));
const version = pkg.version;
const repository = pkg.piConfig?.forkRepository;
if (repository !== "chenhaoxiang/pi" || !/^\d+\.\d+\.\d+-fork\.[1-9]\d*$/.test(version)) {
	throw new Error("Expected maintained Pi fork metadata");
}
const sourceCommit = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (!candidate && execFileSync("git", ["-C", root, "status", "--porcelain"], { encoding: "utf8" }).trim()) {
	throw new Error("Release provenance requires a clean committed source; use --candidate only for local validation");
}
const packages = getPublicWorkspacePackages();
if (packages.some((entry) => entry.version !== version)) throw new Error("Public workspace versions must be lockstep");
mkdirSync(output, { recursive: true });
const tarballs = packReleasePackages(packages, join(output, "tarballs"));
const consumer = join(output, "node");
installCodingAgentConsumer(consumer, tarballs);
smokeTestCodingAgentConsumer(consumer);
symlinkSync("node_modules/.bin/pi", join(consumer, "pi"));
const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const assets = [...tarballs.values()];
if (!candidate) {
	const manifest = {
		schemaVersion: 1,
		repository: `https://github.com/${repository}`,
		version,
		tag: `v${version}`,
		sourceCommit,
		communityBase: version.replace(/-fork\.[1-9]\d*$/, ""),
		packageSha256: digest(tarballs.get(pkg.name)),
	};
	const content = `${JSON.stringify(manifest, null, 2)}\n`;
	const file = join(output, "release-manifest.json");
	writeFileSync(file, content);
	writeFileSync(join(consumer, "node_modules", pkg.name, "release-manifest.json"), content);
	assets.push(file);
}
const archive = join(output, `pi-node-${version}.tar.gz`);
execFileSync("tar", ["-czf", archive, "-C", output, "node", "tarballs"]);
assets.push(archive);
writeFileSync(join(output, "SHA256SUMS"), assets.map((file) => `${digest(file)}  ${relative(output, file)}`).join("\n") + "\n");
console.log(candidate ? "Candidate validated; no release/source provenance emitted." : `Release source: ${sourceCommit}`);
console.log(`Node consumer and ${tarballs.size} lockstep workspace tarballs: ${output}`);
