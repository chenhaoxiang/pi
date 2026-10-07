import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DefaultPackageManager } from "../src/core/package-manager.ts";
import { handlePackageCommand } from "../src/package-manager-cli.ts";
import * as childProcess from "../src/utils/child-process.ts";
import { checkForNewPiVersion, getLatestPiRelease, isMaintainedForkVersion } from "../src/utils/version-check.ts";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

describe("maintained fork update channel", () => {
	it.each(["1.0.4-fork.1", "1.0.4-fork.2", "2.0.0-fork.1"])(
		"identifies the bounded maintained suffix: %s",
		(version) => {
			expect(isMaintainedForkVersion(version)).toBe(true);
		},
	);
	it.each(["1.0.4", "1.0.4-beta.1", "1.0.4-fork.0", "1.0.4-fork.01", "1.0.4-fork.1+build", "01.0.4-fork.1"])(
		"does not relabel other versions: %s",
		(version) => {
			expect(isMaintainedForkVersion(version)).toBe(false);
		},
	);
	it("does not query the community release service for a fork or show its update banner", async () => {
		vi.stubEnv("PI_OFFLINE", "");
		vi.stubEnv("PI_SKIP_VERSION_CHECK", "");
		const fetch = vi.fn(async () => new Response(JSON.stringify({ version: "1.0.5" })));
		vi.stubGlobal("fetch", fetch);
		expect(await getLatestPiRelease("1.0.4-fork.1")).toBeUndefined();
		expect(await checkForNewPiVersion("1.0.4-fork.1")).toBeUndefined();
		expect(fetch).not.toHaveBeenCalled();
	});
	it.each([
		["update", "--self"],
		["update", "--all"],
		["update", "--self", "--force"],
	])("refuses fork CLI target before fetch, extension update or process spawn: %j", async (...args) => {
		const root = mkdtempSync(join(tmpdir(), "pi-fork-update-"));
		const cwd = process.cwd();
		const exitCode = process.exitCode;
		vi.stubEnv("PI_CODING_AGENT_DIR", join(root, "agent"));
		const fetch = vi.fn();
		vi.stubGlobal("fetch", fetch);
		const update = vi.spyOn(DefaultPackageManager.prototype, "update").mockResolvedValue(undefined);
		const spawn = vi.spyOn(childProcess, "spawnProcess").mockImplementation(() => {
			throw new Error("Unexpected process spawn");
		});
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		vi.spyOn(console, "log").mockImplementation(() => {});
		try {
			process.chdir(root);
			process.exitCode = undefined;
			expect(await handlePackageCommand(args)).toBe(true);
			expect(process.exitCode).toBe(1);
			expect(error.mock.calls.flat().join(" ")).toContain("Maintained Pi fork self-update is disabled");
			expect(fetch).not.toHaveBeenCalled();
			expect(update).not.toHaveBeenCalled();
			expect(spawn).not.toHaveBeenCalled();
		} finally {
			process.chdir(cwd);
			process.exitCode = exitCode;
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("retains the ordinary community release lookup", async () => {
		vi.stubEnv("PI_OFFLINE", "");
		const fetch = vi.fn(async () => new Response(JSON.stringify({ version: "1.0.5" }), { status: 200 }));
		vi.stubGlobal("fetch", fetch);
		expect((await getLatestPiRelease("1.0.4"))?.version).toBe("1.0.5");
		expect(fetch).toHaveBeenCalledTimes(1);
	});
});
