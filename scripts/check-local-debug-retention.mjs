import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Metadata-only inspection. Never follows symlinks or reads/removes artifact contents. */
export function inspectDebugRetention(root, options = {}) {
	const maxBytes = options.maxBytes ?? 2 * 1024 ** 3;
	const olderThanDays = options.olderThanDays ?? 14;
	const now = options.now ?? Date.now();
	if (!Number.isSafeInteger(maxBytes) || maxBytes < 0 || !Number.isSafeInteger(olderThanDays) || olderThanDays < 0) {
		throw new Error("Retention thresholds must be nonnegative safe integers.");
	}
	const rootStat = fs.lstatSync(root);
	if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new Error("Expected a non-symlink debug artifact directory.");
	let files = 0;
	let bytes = 0;
	let oldFiles = 0;
	let oldBytes = 0;
	let skippedSymlinks = 0;
	const stack = [path.resolve(root)];
	while (stack.length) {
		const directory = stack.pop();
		for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
			const target = path.join(directory, entry.name);
			const stat = fs.lstatSync(target);
			if (stat.isSymbolicLink()) { skippedSymlinks++; continue; }
			if (stat.isDirectory()) { stack.push(target); continue; }
			if (!stat.isFile()) continue;
			files++;
			bytes += stat.size;
			if (stat.mtimeMs < now - olderThanDays * 86400000) { oldFiles++; oldBytes += stat.size; }
		}
	}
	return { files, bytes, oldFiles, oldBytes, skippedSymlinks, olderThanDays, maxBytes, exceedsCapacity: bytes > maxBytes, mode: "read-only", contentsRead: false, removed: 0 };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
	try {
		if (process.argv.length !== 3) throw new Error("Usage: node scripts/check-local-debug-retention.mjs <debug-artifact-directory>");
		console.log(JSON.stringify(inspectDebugRetention(process.argv[2]), null, 2));
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
