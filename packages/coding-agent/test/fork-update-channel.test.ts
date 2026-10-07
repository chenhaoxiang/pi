import { afterEach, describe, expect, it, vi } from "vitest";
import { checkForNewPiVersion, getLatestPiRelease, isMaintainedForkVersion } from "../src/utils/version-check.ts";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
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
	it("retains the ordinary community release lookup", async () => {
		vi.stubEnv("PI_OFFLINE", "");
		const fetch = vi.fn(async () => new Response(JSON.stringify({ version: "1.0.5" }), { status: 200 }));
		vi.stubGlobal("fetch", fetch);
		expect((await getLatestPiRelease("1.0.4"))?.version).toBe("1.0.5");
		expect(fetch).toHaveBeenCalledTimes(1);
	});
});
