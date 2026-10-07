import { describe, expect, it, vi } from "vitest";
import { fauxAssistantMessage } from "../src/providers/faux.ts";
import { isRetryableAssistantError, type RetryPolicy, retryAssistantCall } from "../src/utils/retry.ts";

const disconnected = "stream error: stream disconnected before completion: stream closed before response.completed";
const policy: RetryPolicy = { enabled: true, maxRetries: 3, baseDelayMs: 0 };

// Characterize the existing retry boundary before extending its transport wording.
describe("existing retry safety boundaries", () => {
	it.each(["fetch failed", "503 service unavailable", "OpenAI Responses stream ended without a stop reason"])(
		"retains transient classification: %s",
		(errorMessage) => {
			expect(isRetryableAssistantError(fauxAssistantMessage("", { stopReason: "error", errorMessage }))).toBe(true);
		},
	);

	it.each(["insufficient_quota", "billing exhausted", "subscription_sharing_usage_limit_exceeded"])(
		"keeps account limits terminal: %s",
		(errorMessage) => {
			expect(isRetryableAssistantError(fauxAssistantMessage("", { stopReason: "error", errorMessage }))).toBe(false);
		},
	);
});

// Regression for the owner-reported OpenAI Responses/CLI proxy disconnect.
describe("incomplete Responses stream retry", () => {
	it.each([
		disconnected,
		"stream disconnected before completion",
		"stream closed before response.completed",
		"WebSocket stream closed before response.completed",
		"STREAM CLOSED BEFORE RESPONSE.COMPLETED",
	])("recognizes premature transport completion: %s", (errorMessage) => {
		expect(isRetryableAssistantError(fauxAssistantMessage("", { stopReason: "error", errorMessage }))).toBe(true);
	});

	it.each([
		"stream error: invalid tool arguments",
		"response.completed is missing a required field",
		"stream closed before responseXcompleted",
	])("does not classify unrelated stream/validation failures: %s", (errorMessage) => {
		expect(isRetryableAssistantError(fauxAssistantMessage("", { stopReason: "error", errorMessage }))).toBe(false);
	});

	it.each(["insufficient_quota", "billing", "subscription_sharing_usage_limit_exceeded"])(
		"does not override account limits when wrapped in a disconnect: %s",
		(limit) => {
			expect(
				isRetryableAssistantError(
					fauxAssistantMessage("", { stopReason: "error", errorMessage: `${disconnected}: ${limit}` }),
				),
			).toBe(false);
		},
	);

	it("recovers using the existing bounded retry callbacks", async () => {
		const produce = vi
			.fn()
			.mockResolvedValueOnce(fauxAssistantMessage("", { stopReason: "error", errorMessage: disconnected }))
			.mockResolvedValueOnce(fauxAssistantMessage("recovered"));
		const onRetryScheduled = vi.fn();
		const onRetryFinished = vi.fn();
		const response = await retryAssistantCall(produce, policy, undefined, { onRetryScheduled, onRetryFinished });
		expect(response.content).toEqual([{ type: "text", text: "recovered" }]);
		expect(produce).toHaveBeenCalledTimes(2);
		expect(onRetryScheduled).toHaveBeenCalledWith(1, 3, 0, disconnected);
		expect(onRetryFinished).toHaveBeenCalledWith(true, 1);
	});

	it("stops at the configured retry budget", async () => {
		const produce = vi.fn(async () => fauxAssistantMessage("", { stopReason: "error", errorMessage: disconnected }));
		const onRetryFinished = vi.fn();
		const response = await retryAssistantCall(produce, policy, undefined, { onRetryFinished });
		expect(response.stopReason).toBe("error");
		expect(produce).toHaveBeenCalledTimes(4);
		expect(onRetryFinished).toHaveBeenCalledWith(false, 3, disconnected);
	});

	it("respects disabled retry", async () => {
		const produce = vi.fn(async () => fauxAssistantMessage("", { stopReason: "error", errorMessage: disconnected }));
		await retryAssistantCall(produce, { ...policy, enabled: false }, undefined);
		expect(produce).toHaveBeenCalledTimes(1);
	});

	it("does not retry a user-aborted response with disconnect wording", async () => {
		const produce = vi.fn(async () =>
			fauxAssistantMessage("", { stopReason: "aborted", errorMessage: disconnected }),
		);
		const response = await retryAssistantCall(produce, policy, undefined);
		expect(response.stopReason).toBe("aborted");
		expect(produce).toHaveBeenCalledTimes(1);
	});

	it("allows cancellation during disconnect backoff", async () => {
		const controller = new AbortController();
		const produce = vi.fn(async () => fauxAssistantMessage("", { stopReason: "error", errorMessage: disconnected }));
		const onRetryFinished = vi.fn();
		const response = await retryAssistantCall(produce, { ...policy, baseDelayMs: 10_000 }, controller.signal, {
			onRetryScheduled: () => controller.abort(),
			onRetryFinished,
		});
		expect(response.stopReason).toBe("aborted");
		expect(response.errorMessage).toBeUndefined();
		expect(produce).toHaveBeenCalledTimes(1);
		expect(onRetryFinished).toHaveBeenCalledWith(false, 1, disconnected);
	});
});
