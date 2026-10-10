import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const peers = [
	["pi-coding-agent", [[".", "index.js", "."], ["./rpc-entry", "rpc-entry.js", "./rpc-entry"]]],
	["pi-agent-core", [[".", "index.js", "."]]],
	["pi-ai", [[".", "index.js", "./compat"], ["./compat", "compat.js", "./compat"], ["./oauth", "oauth.js", "./oauth"], ["./providers/all", "providers/all.js", "./providers/all"]]],
	["pi-tui", [[".", "index.js", "."]]],
	["chord", [[".", "index.js", "."], ["./context", "context/index.js", "./context"]]],
];

function manifest(root) {
	return JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
}

function validateHost(root, pkg) {
	if (pkg.piHostPeerShim === true) throw new Error("Generated peer shims cannot be used as a Pi host.");
	if (pkg.name !== "@earendil-works/pi-coding-agent" || !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-fork\.[1-9]\d*)?$/.test(pkg.version ?? "")) {
		throw new Error("Expected an identified stable Pi host, not a shim, unknown package or arbitrary prerelease.");
	}
	if (typeof pkg.bin?.pi !== "string") throw new Error("Expected a real Pi host with a declared bin.pi entry.");
	const cli = fs.realpathSync(path.resolve(root, pkg.bin.pi));
	if (!cli.startsWith(`${fs.realpathSync(root)}${path.sep}`) || !fs.statSync(cli).isFile()) {
		throw new Error("Pi host launcher escapes package or is not a file.");
	}
	return cli;
}

export function resolveLauncherHost(launcher) {
	const actualLauncher = fs.realpathSync(launcher);
	let current = path.dirname(actualLauncher);
	while (path.dirname(current) !== current) {
		const candidate = path.join(current, "package.json");
		if (fs.existsSync(candidate)) {
			const pkg = manifest(current);
			if (pkg.name === "@earendil-works/pi-coding-agent") {
				if (validateHost(current, pkg) !== actualLauncher) throw new Error("Selected launcher differs from the host's declared bin.pi.");
				return current;
			}
		}
		current = path.dirname(current);
	}
	throw new Error("Launcher does not resolve inside a Node Pi coding-agent package; pass --host explicitly for a native launcher.");
}

function importTarget(entry) {
	if (typeof entry === "string") return entry;
	if (entry && typeof entry === "object") return importTarget(entry.import ?? entry.default);
	return undefined;
}

function resolveEntry(root, pkg, subpath) {
	const map = pkg.exports;
	let target;
	if (map === undefined && subpath === ".") target = pkg.main ?? "index.js";
	else {
		target = importTarget(map?.[subpath]);
		if (!target) {
			for (const [pattern, entry] of Object.entries(map ?? {})) {
				if (!pattern.includes("*")) continue;
				const [prefix, suffix] = pattern.split("*");
				if (subpath.startsWith(prefix) && subpath.endsWith(suffix)) {
					const wildcard = subpath.slice(prefix.length, suffix.length ? -suffix.length : undefined);
					target = importTarget(entry)?.replaceAll("*", wildcard);
					break;
				}
			}
		}
	}
	if (!target) throw new Error(`Missing runtime export ${pkg.name}${subpath.slice(1)}`);
	const absolute = fs.realpathSync(path.resolve(root, target));
	if (!absolute.startsWith(`${fs.realpathSync(root)}${path.sep}`) || !fs.statSync(absolute).isFile()) {
		throw new Error(`Runtime export escapes package or is not a file: ${pkg.name}${subpath.slice(1)}`);
	}
	return absolute;
}

export function planHostPeers(host) {
	host = fs.realpathSync(host);
	const owner = manifest(host);
	validateHost(host, owner);
	const packages = [];
	for (const [folder, entries] of peers) {
		const name = `@earendil-works/${folder}`;
		let root = folder === "pi-coding-agent" ? host : undefined;
		for (let parent = host; !root; parent = path.dirname(parent)) {
			const candidate = path.join(parent, "node_modules", name);
			if (fs.existsSync(path.join(candidate, "package.json")) && manifest(candidate).name === name) root = candidate;
			if (path.dirname(parent) === parent) break;
		}
		if (!root) throw new Error(`Missing host peer ${name}`);
		const pkg = manifest(root);
		if (pkg.version !== owner.version) throw new Error(`Peer version differs from host: ${name}@${pkg.version}, host=${owner.version}`);
		const exports = {};
		const files = {};
		for (const [subpath, relative, hostSubpath] of entries) {
			const target = resolveEntry(root, pkg, hostSubpath);
			exports[subpath] = `./${relative}`;
			files[relative] = `export * from ${JSON.stringify(pathToFileURL(target).href)};\n`;
		}
		exports["./package.json"] = "./package.json";
		files["package.json"] = `${JSON.stringify({ name, version: pkg.version, private: true, piHostPeerShim: true, type: "module", main: "./index.js", exports }, null, 2)}\n`;
		packages.push({ folder, files });
	}
	return { host, version: owner.version, packages };
}

export function writeHostPeers(plan, output) {
	output = path.resolve(output);
	const parent = path.dirname(output);
	fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
	const parentStat = fs.lstatSync(parent);
	if (!parentStat.isDirectory() || parentStat.isSymbolicLink() ||
		(typeof process.getuid === "function" && (parentStat.uid !== process.getuid() || (parentStat.mode & 0o022) !== 0))) {
		throw new Error("Output parent must be a trusted owner-owned, non-symlink directory.");
	}
	try {
		fs.mkdirSync(output, { mode: 0o700 });
	} catch (error) {
		if (error.code === "EEXIST") throw new Error("Output already exists; never overwrite shims belonging to a running consumer.");
		throw error;
	}
	for (const pkg of plan.packages) {
		for (const [relative, content] of Object.entries(pkg.files)) {
			const target = path.join(output, pkg.folder, relative);
			fs.mkdirSync(path.dirname(target), { recursive: true });
			fs.writeFileSync(target, content, { flag: "wx" });
		}
	}
	fs.writeFileSync(path.join(output, "host-peer-manifest.json"), `${JSON.stringify({ schemaVersion: 1, host: plan.host, version: plan.version }, null, 2)}\n`, { flag: "wx" });
}

export function checkHostPeers(plan, output) {
	for (const pkg of plan.packages) {
		for (const [relative, content] of Object.entries(pkg.files)) {
			if (fs.readFileSync(path.join(output, pkg.folder, relative), "utf8") !== content) {
				throw new Error(`Stale or modified peer shim: ${pkg.folder}/${relative}`);
			}
		}
	}
	const provenance = JSON.parse(fs.readFileSync(path.join(output, "host-peer-manifest.json"), "utf8"));
	if (provenance.host !== plan.host || provenance.version !== plan.version) throw new Error("Peer shim host provenance differs from the selected launcher.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
	try {
		const args = process.argv.slice(2);
		const options = {};
		for (let i = 0; i < args.length; i += 2) {
			if (!["--launcher", "--host", "--out", "--check"].includes(args[i]) || !args[i + 1]) throw new Error("Usage: --launcher <pi> or --host <package> and exactly one of --out <new-directory> or --check <directory>");
			options[args[i]] = args[i + 1];
		}
		if (Boolean(options["--launcher"]) === Boolean(options["--host"]) || Boolean(options["--out"]) === Boolean(options["--check"])) throw new Error("Choose exactly one host source and one operation.");
		const plan = planHostPeers(options["--host"] ?? resolveLauncherHost(options["--launcher"]));
		if (options["--out"]) writeHostPeers(plan, path.resolve(options["--out"]));
		else checkHostPeers(plan, path.resolve(options["--check"]));
		console.log(JSON.stringify({ version: plan.version, host: plan.host, packages: plan.packages.length, checked: Boolean(options["--check"]) }));
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
