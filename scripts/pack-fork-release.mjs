#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { installConsumer, smokeTestNpmConsumer } from "./local-package-install.mjs";
import { produceArtifactSet } from "./package-artifacts.mjs";
import { codingAgentName, smokeTestCodingAgent } from "./coding-agent-smoke.mjs";
import { getPublicWorkspacePackages } from "./release-packages.mjs";
import { isMaintainedForkVersion } from "../packages/coding-agent/src/utils/fork-version.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const args = process.argv.slice(2);
const candidate = args.includes("--candidate");
const index = args.indexOf("--out");
const binaryIndex = args.indexOf("--binary");
if (
	index < 0 || !args[index + 1] || (binaryIndex >= 0 && !args[binaryIndex + 1]) ||
	args.some((arg, i) => i !== index + 1 && !(binaryIndex >= 0 && i === binaryIndex + 1) && !["--out", "--binary", "--candidate"].includes(arg))
) {
	throw new Error("Usage: node scripts/pack-fork-release.mjs --out <new external directory> [--binary <tested archive>] [--candidate]");
}
if (!candidate && binaryIndex < 0) throw new Error("A release requires a separately tested native binary archive");
const output = resolve(args[index + 1]);
const offset = relative(root, output);
if (!offset || (!offset.startsWith("..") && !isAbsolute(offset)) || existsSync(output)) {
	throw new Error("Output must be a new directory outside the source checkout");
}
const pkg = JSON.parse(readFileSync(join(root, "packages/coding-agent/package.json"), "utf8"));
const version = pkg.version;
const repository = pkg.piConfig?.forkRepository;
if (repository !== "chenhaoxiang/pi" || !isMaintainedForkVersion(version)) {
	throw new Error("Expected maintained Pi fork metadata");
}
const sourceCommit = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (!candidate && execFileSync("git", ["-C", root, "status", "--porcelain"], { encoding: "utf8" }).trim()) {
	throw new Error("Release provenance requires a clean committed source; use --candidate only for local validation");
}
const packages = getPublicWorkspacePackages();
if (packages.some((entry) => entry.version !== version)) throw new Error("Public workspace versions must be lockstep");
mkdirSync(output, { recursive: true });
const artifactSet = produceArtifactSet({ build: false, outDir: join(output, "package-artifacts"), repoRoot: root });
const tarballDirectory = join(output, "tarballs");
mkdirSync(tarballDirectory);
const tarballs = new Map();
for (const artifact of artifactSet.packages) {
	const filename = `${artifact.name.replace(/^@/, "").replace("/", "-")}-${artifact.version}.tgz`;
	const target = join(tarballDirectory, filename);
	cpSync(artifact.tarballPath, target);
	artifact.tarballPath = target;
	tarballs.set(artifact.name, target);
}
const consumer = join(output, "node");
installConsumer({ artifactSet, directory: consumer, packageNames: [codingAgentName] });
smokeTestNpmConsumer({ artifactSet, directory: consumer, packageName: codingAgentName });
smokeTestCodingAgent(consumer);
symlinkSync("node_modules/.bin/pi", join(consumer, "pi"));
const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const assets = [...tarballs.values()].map((file) => {
	const target = join(output, basename(file));
	cpSync(file, target);
	return target;
});
if (binaryIndex >= 0) {
	const binary = resolve(args[binaryIndex + 1]);
	if (!/^pi-(?:darwin|linux)-(?:arm64|x64)\.tar\.gz$/.test(basename(binary)) || !lstatSync(binary).isFile()) {
		throw new Error("Expected an ordinary tested Unix native release archive");
	}
	const binaryPackage = JSON.parse(execFileSync("tar", ["-xOf", binary, "pi/package.json"], { encoding: "utf8" }));
	if (binaryPackage.version !== version || binaryPackage.piConfig?.forkRepository !== repository) {
		throw new Error("Native binary archive metadata does not match this fork release");
	}
	const target = join(output, basename(binary));
	cpSync(binary, target);
	assets.push(target);
}
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
	for (const [source, name] of [["package.json", "pi-coding-agent-install-package.json"], ["package-lock.json", "pi-coding-agent-install-package-lock.json"]]) {
		const target = join(output, name);
		cpSync(join(root, "packages/coding-agent/install-lock", source), target);
		assets.push(target);
	}
}
const archive = join(output, `pi-node-${version}.tar.gz`);
execFileSync("tar", ["-czf", archive, "-C", output, "node", "tarballs"]);
assets.push(archive);
writeFileSync(join(output, "SHA256SUMS"), assets.map((file) => `${digest(file)}  ${basename(file)}`).join("\n") + "\n");
console.log(candidate ? "Candidate validated; no release/source provenance emitted." : `Release source: ${sourceCommit}`);
console.log(`Node consumer and ${tarballs.size} lockstep workspace tarballs: ${output}`);
