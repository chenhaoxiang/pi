import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import { createHarness } from "../harness.ts";

// Owner-reported TPM throttle: the billing help URL must not suppress automatic retries.
const rateLimitMessage =
	"Error: Rate limit reached for gpt-6.1-sol in organization org_test on tokens per min (TPM): Limit 1000000, Used 667065, Requested 416459. Please try again in 5.011s. Visit https://platform.openai.com/account/rate-limits to learn more. You can increase your rate limit by adding a payment method to your account at https://platform.openai.com/account/billing.";

describe("rate limits with billing help URLs", () => {
	it("retries through AgentSession and preserves the original diagnostic", async () => {
		const harness = await createHarness({ settings: { retry: { enabled: true, maxRetries: 3, baseDelayMs: 1 } } });
		try {
			harness.setResponses([
				fauxAssistantMessage("", { stopReason: "error", errorMessage: rateLimitMessage }),
				fauxAssistantMessage("recovered"),
			]);

			await harness.session.prompt("test");

			expect(harness.faux.state.callCount).toBe(2);
			expect(harness.eventsOfType("auto_retry_start")).toMatchObject([
				{ attempt: 1, maxAttempts: 3, delayMs: 1, errorMessage: rateLimitMessage },
			]);
			expect(harness.eventsOfType("auto_retry_end")).toMatchObject([{ success: true, attempt: 1 }]);
			expect(harness.eventsOfType("compaction_start")).toEqual([]);
			expect(harness.session.messages.at(-1)).toMatchObject({
				role: "assistant",
				content: [{ type: "text", text: "recovered" }],
			});
			expect(harness.session.isRetrying).toBe(false);
		} finally {
			harness.cleanup();
		}
	});

	it("retains the configured retry budget and stepped backoff", async () => {
		const harness = await createHarness({ settings: { retry: { enabled: true, maxRetries: 2, baseDelayMs: 1 } } });
		try {
			harness.setResponses(
				Array.from({ length: 3 }, () =>
					fauxAssistantMessage("", { stopReason: "error", errorMessage: rateLimitMessage }),
				),
			);

			await harness.session.prompt("test");

			expect(harness.faux.state.callCount).toBe(3);
			expect(harness.eventsOfType("auto_retry_start").map((event) => event.delayMs)).toEqual([1, 3]);
			expect(harness.eventsOfType("auto_retry_end")).toMatchObject([
				{ success: false, attempt: 2, finalError: rateLimitMessage },
			]);
			expect(harness.session.isRetrying).toBe(false);
		} finally {
			harness.cleanup();
		}
	});

	it("does not retry when disabled", async () => {
		const harness = await createHarness({ settings: { retry: { enabled: false, maxRetries: 3, baseDelayMs: 1 } } });
		try {
			harness.setResponses([fauxAssistantMessage("", { stopReason: "error", errorMessage: rateLimitMessage })]);

			await harness.session.prompt("test");

			expect(harness.faux.state.callCount).toBe(1);
			expect(harness.eventsOfType("auto_retry_start")).toEqual([]);
		} finally {
			harness.cleanup();
		}
	});

	it.each([
		`${rateLimitMessage} insufficient_quota`,
		"429 billing exhausted; see https://platform.openai.com/account/rate-limits",
		'429 {"url":"https://platform.openai.com/account/billing","code":"insufficient_quota"}',
	])("does not retry actual account exhaustion: %s", async (errorMessage) => {
		const harness = await createHarness({ settings: { retry: { enabled: true, maxRetries: 3, baseDelayMs: 1 } } });
		try {
			harness.setResponses([fauxAssistantMessage("", { stopReason: "error", errorMessage })]);

			await harness.session.prompt("test");

			expect(harness.faux.state.callCount).toBe(1);
			expect(harness.eventsOfType("auto_retry_start")).toEqual([]);
		} finally {
			harness.cleanup();
		}
	});
});
