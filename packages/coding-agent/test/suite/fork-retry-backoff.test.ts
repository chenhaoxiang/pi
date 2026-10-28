import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHarness, type Harness } from "./harness.ts";

const overloadError =
	'codex-local-8319 API error (503): {"message":"auth_unavailable: no auth available (providers=codex, model=test-model; last upstream error: server_is_overloaded: Our servers are currently overloaded. Please try again later.)","type":"server_error","code":"internal_server_error"}';
const retrySeconds = [1, 3, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 26, 30, 35, 40, 50, 60, 70, 80, 90, 100];

describe("fork default retry backoff", () => {
	let harness: Harness | undefined;

	afterEach(() => {
		harness?.cleanup();
		harness = undefined;
		vi.useRealTimers();
	});

	it.each(["stop", "error"] as const)("allows exactly 600 retries ending in %s", async (stopReason) => {
		harness = await createHarness();
		harness.setResponses([
			...Array.from({ length: 600 }, () =>
				fauxAssistantMessage("", { stopReason: "error", errorMessage: overloadError }),
			),
			fauxAssistantMessage("done", {
				stopReason,
				...(stopReason === "error" ? { errorMessage: overloadError } : {}),
			}),
		]);
		vi.useFakeTimers();
		const firstRetry = new Promise<void>((resolve) => {
			harness!.session.subscribe((event) => {
				if (event.type === "auto_retry_start" && event.attempt === 1) resolve();
			});
		});

		const prompt = harness.session.prompt("test");
		await firstRetry;
		await vi.runAllTimersAsync();
		await prompt;

		const retries = harness.eventsOfType("auto_retry_start");
		expect(retries).toHaveLength(600);
		expect(retries.every((event, i) => event.attempt === i + 1 && event.maxAttempts === 600)).toBe(true);
		expect(retries.map((event) => event.delayMs)).toEqual(
			[...retrySeconds, ...Array<number>(578).fill(100)].map((seconds) => seconds * 1000),
		);
		expect(harness.faux.state.callCount).toBe(601);
		expect(harness.session.isRetrying).toBe(false);
		expect(harness.eventsOfType("auto_retry_end")).toEqual([
			{
				type: "auto_retry_end",
				success: stopReason === "stop",
				attempt: 600,
				...(stopReason === "error" ? { finalError: overloadError } : {}),
			},
		]);
	});

	it("can cancel during a 100-second retry sleep", async () => {
		harness = await createHarness();
		harness.setResponses(
			Array.from({ length: 22 }, () =>
				fauxAssistantMessage("", { stopReason: "error", errorMessage: overloadError }),
			),
		);
		vi.useFakeTimers();
		const firstRetry = new Promise<void>((resolve) => {
			harness!.session.subscribe((event) => {
				if (event.type === "auto_retry_start" && event.attempt === 1) resolve();
			});
		});

		const prompt = harness.session.prompt("test");
		await firstRetry;
		await vi.advanceTimersByTimeAsync(retrySeconds.slice(0, 21).reduce((sum, seconds) => sum + seconds * 1000, 0));
		expect(harness.eventsOfType("auto_retry_start").at(-1)).toMatchObject({ attempt: 22, delayMs: 100000 });
		harness.session.abortRetry();
		await prompt;
		await vi.runAllTimersAsync();

		expect(harness.faux.state.callCount).toBe(22);
		expect(harness.session.isRetrying).toBe(false);
		expect(harness.eventsOfType("auto_retry_end")).toEqual([
			{ type: "auto_retry_end", success: false, attempt: 22, finalError: "Retry cancelled" },
		]);
	});
});
