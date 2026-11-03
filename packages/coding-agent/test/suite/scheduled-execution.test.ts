import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CacheWarmer } from "../../src/core/cache-warmer.ts";
import type {
	ScheduledExecutionRequest,
	ScheduledRunCheckpoint,
	ScheduledRunHandle,
	ScheduledRunPolicy,
} from "../../src/core/scheduled-execution.ts";
import { SCHEDULED_CHECKPOINT_ENTRY, SCHEDULED_RECEIPT_ENTRY } from "../../src/core/scheduled-execution.ts";
import { createAgentSession } from "../../src/core/sdk.ts";
import { SessionManager } from "../../src/core/session-manager.ts";
import { createHarness, type Harness } from "./harness.ts";

const overload = () => fauxAssistantMessage("", { stopReason: "error", errorMessage: "503 server overloaded" });

function start(harness: Harness, policy: Partial<ScheduledRunPolicy> = {}): ScheduledRunHandle {
	const request: ScheduledExecutionRequest = {
		binding: {
			jobId: "synthetic-job",
			attemptId: "attempt-1",
			ownerSessionId: harness.session.sessionId,
			ownerEpoch: 1,
			revision: 1,
		},
		policy: { softDeadlineMs: 20_000, hardDeadlineMs: 30_000, ...policy },
		content: "Perform this authorized synthetic occurrence without replaying prior tools",
	};
	const accepted = harness.session.scheduledExecution.start(request);
	if (!accepted.accepted) throw new Error(accepted.reason);
	return accepted.handle;
}

function gate(): { promise: Promise<void>; resolve: () => void } {
	let resolve!: () => void;
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

describe("scheduled execution legacy characterization", () => {
	let harness: Harness | undefined;

	afterEach(() => {
		harness?.cleanup();
		harness = undefined;
		vi.useRealTimers();
	});

	it("retains native custom source and the void extension abort contract", async () => {
		const starts: string[] = [];
		harness = await createHarness({
			extensionFactories: [
				(pi) => {
					pi.on("before_agent_start", (event) => {
						starts.push(event.messageType);
					});
				},
			],
		});
		const abort = vi.fn();
		await harness.session.bindExtensions({ abortHandler: abort });
		expect(harness.session.extensionRunner.createContext().abort()).toBeUndefined();
		expect(abort).toHaveBeenCalledOnce();
		harness.setResponses([fauxAssistantMessage("done")]);
		await harness.session.sendCustomMessage(
			{ customType: "scheduled_prompt", content: "authorized fixture", display: false },
			{ triggerTurn: true },
		);
		expect(starts).toEqual(["custom"]);
		expect(harness.session.messages.some((message) => message.role === "user")).toBe(false);
		expect(harness.eventsOfType("agent_settled")).toEqual([{ type: "agent_settled", aborted: false }]);
	});

	it("retries only a failed response and retains earlier completed tool entries", async () => {
		const execute = vi.fn(async () => ({ content: [{ type: "text" as const, text: "saved once" }], details: {} }));
		harness = await createHarness({
			settings: { retry: { maxRetries: 1, baseDelayMs: 1 }, compaction: { enabled: false } },
			extensionFactories: [
				(pi) => {
					pi.registerTool({
						name: "save_fixture",
						label: "save",
						description: "Synthetic write",
						parameters: Type.Object({}),
						execute,
					});
				},
			],
		});
		harness.setResponses([
			fauxAssistantMessage([fauxToolCall("save_fixture", {}, { id: "saved-once" })], { stopReason: "toolUse" }),
			overload(),
			fauxAssistantMessage("done"),
		]);
		await harness.session.prompt("save once");
		expect(execute).toHaveBeenCalledOnce();
		expect(harness.faux.state.callCount).toBe(3);
		const entries = harness.sessionManager
			.getBranch()
			.filter((entry) => entry.type === "message" && entry.message.role === "toolResult");
		expect(entries).toHaveLength(1);
		expect(harness.session.messages.filter((message) => message.role === "toolResult")).toHaveLength(1);
	});
});

describe("native scheduled execution capability v1", () => {
	let harness: Harness | undefined;

	afterEach(() => {
		harness?.cleanup();
		harness = undefined;
		vi.useRealTimers();
	});

	it("negotiates an additive capability and refuses a foreign binding before inference", async () => {
		harness = await createHarness();
		const context = harness.session.extensionRunner.createContext();
		expect(context.scheduledExecution?.version).toBe(1);
		const consume = (host: { scheduledExecution?: typeof context.scheduledExecution }) => {
			if (host.scheduledExecution?.version !== 1) return "unsupported";
			return "supported";
		};
		expect(consume({})).toBe("unsupported");
		expect(consume(context)).toBe("supported");
		expect(() =>
			harness!.session.scheduledExecution.start({
				binding: { jobId: "job", attemptId: "attempt", ownerSessionId: "other", ownerEpoch: 1, revision: 1 },
				policy: { softDeadlineMs: 1, hardDeadlineMs: 2 },
				content: "fixture",
			}),
		).toThrow("ownership binding");
		expect(harness.faux.state.callCount).toBe(0);
	});

	it("bounds a continuous 56-response outage without changing global retry choices", async () => {
		harness = await createHarness({
			settings: {
				retry: { maxRetries: 6, baseDelayMs: 1, maxConsecutiveSameErrorRetries: 0 },
				compaction: { enabled: false },
			},
		});
		const settings = harness.settingsManager.getRetrySettings();
		harness.setResponses(Array.from({ length: 56 }, overload));
		vi.useFakeTimers();
		const handle = start(harness);
		await vi.runAllTimersAsync();
		expect(await handle.settled).toMatchObject({
			execution: "deferred",
			reason: "response_retry_exhausted",
			businessOutcome: "unverified",
		});
		expect(harness.faux.state.callCount).toBe(3);
		expect(harness.settingsManager.getRetrySettings()).toEqual(settings);
		await harness.session.waitForIdle();
		const before = harness.faux.state.callCount;
		harness.setResponses([overload(), overload(), overload(), fauxAssistantMessage("ordinary success")]);
		const ordinary = harness.session.prompt("ordinary user turn");
		await vi.runAllTimersAsync();
		await ordinary;
		expect(harness.faux.state.callCount - before).toBe(4);
		expect(handle.requestCancel()).toBe(false);
	});

	it("checkpoints completed tool entries when the final prose never succeeds", async () => {
		const execute = vi.fn(async () => ({
			content: [{ type: "text" as const, text: "actual synthetic result" }],
			details: {},
		}));
		harness = await createHarness({
			settings: { compaction: { enabled: false }, retry: { baseDelayMs: 1 } },
			extensionFactories: [
				(pi) => {
					pi.registerTool({
						name: "effect",
						label: "effect",
						description: "synthetic",
						parameters: Type.Object({}),
						execute,
					});
				},
			],
		});
		harness.setResponses([
			fauxAssistantMessage([fauxToolCall("effect", {}, { id: "effect-once" })], { stopReason: "toolUse" }),
			...Array.from({ length: 5 }, overload),
		]);
		vi.useFakeTimers();
		const handle = start(harness);
		await vi.runAllTimersAsync();
		const receipt = await handle.settled;
		expect(execute).toHaveBeenCalledOnce();
		expect(receipt).toMatchObject({ execution: "deferred", effectStatus: "unknown", businessOutcome: "unverified" });
		const entry = harness.sessionManager.getEntry(receipt.checkpointEntryId);
		if (entry?.type !== "custom") throw new Error("Missing real checkpoint entry");
		expect(entry.customType).toBe(SCHEDULED_CHECKPOINT_ENTRY);
		const checkpoint = entry.data as ScheduledRunCheckpoint;
		expect(checkpoint.completedResults).toHaveLength(1);
		const result = harness.sessionManager.getEntry(checkpoint.completedResults[0]!.entryId);
		expect(result).toMatchObject({ type: "message", message: { role: "toolResult", toolCallId: "effect-once" } });
		expect(harness.session.messages.filter((message) => message.role === "toolResult")).toHaveLength(1);
		expect(
			harness.sessionManager
				.getEntries()
				.some(
					(item) =>
						item.type === "message" && item.message.role === "assistant" && item.message.stopReason === "error",
				),
		).toBe(true);
	});

	it("drains at a completed tool boundary without paying for a final summary", async () => {
		harness = await createHarness({
			extensionFactories: [
				(pi) => {
					pi.registerTool({
						name: "checkpoint_fixture",
						label: "checkpoint",
						description: "synthetic",
						parameters: Type.Object({}),
						execute: async (_id, _params, _signal, _update, ctx) => {
							ctx.scheduledExecution!.active!.checkpoint({
								artifacts: [{ ref: "tmp/actual-fixture", sha256: "a".repeat(64) }],
								nextAction: "Read the result already in history",
							});
							ctx.scheduledExecution!.active!.requestDrain("slice_finished");
							return { content: [{ type: "text", text: "slice ended" }], details: {} };
						},
					});
				},
			],
		});
		harness.setResponses([
			fauxAssistantMessage([fauxToolCall("checkpoint_fixture", {})], { stopReason: "toolUse" }),
			overload(),
		]);
		const handle = start(harness);
		const receipt = await handle.settled;
		expect(receipt.execution).toBe("deferred");
		expect(harness.faux.state.callCount).toBe(1);
		const checkpoint = harness.sessionManager.getEntry(receipt.checkpointEntryId);
		expect(checkpoint).toMatchObject({
			type: "custom",
			data: { completedResultCount: 1, declarations: { nextAction: "Read the result already in history" } },
		});
	});

	it("denies nested wrapper work during drain while native checkpoint access stays available", async () => {
		const external = vi.fn(async () => ({
			content: [{ type: "text" as const, text: "must not execute" }],
			details: {},
		}));
		harness = await createHarness({
			extensionFactories: [
				(pi) => {
					pi.registerTool({
						name: "external",
						label: "external",
						description: "synthetic external effect",
						parameters: Type.Object({}),
						execute: external,
					});
					pi.registerTool({
						name: "wrapper",
						label: "wrapper",
						description: "synthetic wrapper",
						parameters: Type.Object({}),
						execute: async (_id, _params, _signal, _update, ctx) => {
							ctx.scheduledExecution!.active!.requestDrain();
							const denied = await ctx.executeTool("external", {});
							ctx.scheduledExecution!.active!.checkpoint({ waitingReason: "new business work blocked" });
							return {
								content: [{ type: "text", text: denied.isError ? "not executed" : "unexpected execution" }],
								details: {},
							};
						},
					});
				},
			],
		});
		harness.setResponses([fauxAssistantMessage([fauxToolCall("wrapper", {})], { stopReason: "toolUse" })]);
		const handle = start(harness);
		await handle.settled;
		expect(external).not.toHaveBeenCalled();
		expect(harness.faux.state.callCount).toBe(1);
	});

	it("keeps cancellation pending until a non-cooperative tool really returns", async () => {
		const started = gate();
		const closed = gate();
		harness = await createHarness({
			extensionFactories: [
				(pi) => {
					pi.registerTool({
						name: "slow",
						label: "slow",
						description: "non-cooperative synthetic tool",
						parameters: Type.Object({}),
						execute: async () => {
							started.resolve();
							await closed.promise;
							return { content: [{ type: "text", text: "late result" }], details: {} };
						},
					});
				},
			],
		});
		harness.setResponses([fauxAssistantMessage([fauxToolCall("slow", {})], { stopReason: "toolUse" })]);
		const handle = start(harness);
		await started.promise;
		let settled = false;
		void handle.settled.then(() => {
			settled = true;
		});
		expect(handle.requestCancel()).toBe(true);
		expect(handle.snapshot().phase).toBe("cancelling");
		expect(settled).toBe(false);
		expect(harness.session.isIdle).toBe(false);
		closed.resolve();
		expect(await handle.settled).toMatchObject({ execution: "cancelled", effectStatus: "unknown" });
		expect(harness.faux.state.callCount).toBe(1);
	});

	it("holds an explicitly owned child after parent closure and acknowledges its actual end", async () => {
		const closed = gate();
		const cancel = vi.fn();
		harness = await createHarness();
		harness.setResponses([fauxAssistantMessage("native parent done")]);
		const handle = start(harness);
		handle.own({ id: "precise-child", closed: closed.promise, cancel });
		await vi.waitFor(() => expect(handle.snapshot().nativeClosed).toBe(true));
		expect(harness.session.isIdle).toBe(false);
		expect(handle.snapshot().ownedHandles).toEqual(["precise-child"]);
		expect(() => start(harness!)).toThrow("busy");
		handle.requestCancel();
		handle.requestCancel();
		expect(cancel).toHaveBeenCalledOnce();
		closed.resolve();
		expect(await handle.settled).toMatchObject({ execution: "cancelled" });
	});

	it("cannot cancel an unrelated user request with a stale scheduled handle", async () => {
		harness = await createHarness();
		harness.setResponses([fauxAssistantMessage("done")]);
		const handle = start(harness);
		await handle.settled;
		await harness.session.waitForIdle();
		const requested = gate();
		const answer = gate();
		harness.setResponses([
			async () => {
				requested.resolve();
				await answer.promise;
				return fauxAssistantMessage("ordinary done");
			},
		]);
		const user = harness.session.prompt("ordinary work");
		await requested.promise;
		expect(handle.requestCancel()).toBe(false);
		expect(handle.requestDrain()).toBe(false);
		expect(harness.session.agent.signal?.aborted).toBe(false);
		answer.resolve();
		await user;
	});

	it("runs queued user steering as a separate ordinary turn without leaking the scheduled policy", async () => {
		const started = gate();
		const release = gate();
		harness = await createHarness({
			settings: {
				retry: { maxRetries: 6, maxConsecutiveSameErrorRetries: 0, baseDelayMs: 1 },
				compaction: { enabled: false },
			},
			extensionFactories: [
				(pi) => {
					pi.registerTool({
						name: "wait_fixture",
						label: "wait",
						description: "synthetic",
						parameters: Type.Object({}),
						execute: async () => {
							started.resolve();
							await release.promise;
							return { content: [{ type: "text", text: "closed" }], details: {} };
						},
					});
				},
			],
		});
		harness.setResponses([
			fauxAssistantMessage([fauxToolCall("wait_fixture", {})], { stopReason: "toolUse" }),
			overload(),
			overload(),
			overload(),
			fauxAssistantMessage("ordinary completed"),
		]);
		vi.useFakeTimers();
		const handle = start(harness);
		await started.promise;
		await harness.session.prompt("ordinary queued", { streamingBehavior: "steer" });
		handle.requestDrain();
		release.resolve();
		await vi.runAllTimersAsync();
		await handle.settled;
		await harness.session.waitForIdle();
		expect(harness.session.messages.filter((message) => message.role === "user")).toHaveLength(1);
		expect(harness.session.getLastAssistantText()).toBe("ordinary completed");
		expect(harness.faux.state.callCount).toBe(5);
	});

	it("accounts five intermittent failed calls cumulatively without replaying successful tool steps", async () => {
		const execute = vi.fn(async () => ({
			content: [{ type: "text" as const, text: "independent synthetic step" }],
			details: {},
		}));
		harness = await createHarness({
			settings: { compaction: { enabled: false }, retry: { baseDelayMs: 1 } },
			extensionFactories: [
				(pi) => {
					pi.registerTool({
						name: "step",
						label: "step",
						description: "synthetic",
						parameters: Type.Object({}),
						execute,
					});
				},
			],
		});
		harness.setResponses(
			Array.from({ length: 5 }, (_, index) => [
				fauxAssistantMessage([fauxToolCall("step", {}, { id: `step-${index}` })], { stopReason: "toolUse" }),
				async () => {
					await new Promise<void>((resolve) => setTimeout(resolve, 70_000));
					return overload();
				},
			]).flat(),
		);
		vi.useFakeTimers();
		const handle = start(harness, { softDeadlineMs: 900_000, hardDeadlineMs: 1_000_000 });
		await vi.runAllTimersAsync();
		const receipt = await handle.settled;
		expect(receipt).toMatchObject({ execution: "deferred", reason: "recovery_budget_exhausted" });
		expect(receipt.failedRecoveryMs).toBeGreaterThanOrEqual(350_000);
		expect(execute).toHaveBeenCalledTimes(5);
		expect(harness.faux.state.callCount).toBe(10);
	});

	it("does not spend recovery budget or kill valid eighty-minute work at a sixty-minute cadence", async () => {
		harness = await createHarness({ settings: { compaction: { enabled: false } } });
		harness.setResponses([
			async () => {
				await new Promise<void>((resolve) => setTimeout(resolve, 80 * 60_000));
				return fauxAssistantMessage("long acknowledged work ended");
			},
		]);
		vi.useFakeTimers();
		const handle = start(harness, { softDeadlineMs: 90 * 60_000, hardDeadlineMs: 100 * 60_000 });
		const deadline = handle.snapshot().hardDeadlineAt;
		await vi.advanceTimersByTimeAsync(60 * 60_000);
		expect(handle.snapshot().phase).toBe("running");
		expect(handle.snapshot().hardDeadlineAt).toBe(deadline);
		await vi.runAllTimersAsync();
		expect(await handle.settled).toMatchObject({ execution: "completed", failedRecoveryMs: 0 });
	});

	it("respects Retry-After by deferring instead of capping it and sending an early retry", async () => {
		harness = await createHarness({ settings: { compaction: { enabled: false }, retry: { baseDelayMs: 1 } } });
		harness.setResponses([
			async (_context, options, _state, model) => {
				await options?.onResponse?.({ status: 503, headers: { "retry-after": "600" } }, model);
				return overload();
			},
			fauxAssistantMessage("must not request"),
		]);
		vi.useFakeTimers();
		const before = Date.now();
		const handle = start(harness, { recoveryBudgetMs: 5000 });
		await vi.runAllTimersAsync();
		expect(await handle.settled).toMatchObject({
			execution: "deferred",
			retryNotBefore: new Date(before + 600_000).toISOString(),
		});
		expect(harness.faux.state.callCount).toBe(1);
	});

	it("keeps the hard limit and holds slow cancellation even when provider activity continues", async () => {
		const requested = gate();
		const release = gate();
		harness = await createHarness({ settings: { compaction: { enabled: false } } });
		harness.setResponses([
			async () => {
				requested.resolve();
				await release.promise;
				return fauxAssistantMessage("late answer");
			},
		]);
		vi.useFakeTimers();
		const handle = start(harness, { softDeadlineMs: 500, hardDeadlineMs: 1000 });
		await requested.promise;
		await vi.advanceTimersByTimeAsync(1000);
		expect(handle.snapshot().phase).toBe("cancelling");
		expect(handle.snapshot().nativeClosed).toBe(false);
		release.resolve();
		await vi.runAllTimersAsync();
		expect(await handle.settled).toMatchObject({ execution: "cancelled", reason: "hard_deadline" });
	});

	it("reserves native admission before reentrant persistence listeners can dispatch", async () => {
		harness = await createHarness();
		harness.setResponses([fauxAssistantMessage("done")]);
		let refused = 0;
		harness.session.subscribe((event) => {
			if (
				event.type === "entry_appended" &&
				event.entry.type === "custom" &&
				event.entry.customType === "pi.scheduled-start.v1"
			) {
				expect(() => start(harness!)).toThrow("busy");
				refused++;
			}
		});
		const handle = start(harness);
		expect(await handle.settled).toMatchObject({
			runId: handle.runId,
			binding: { ownerSessionId: harness.session.sessionId, attemptId: "attempt-1" },
		});
		expect(refused).toBe(1);
		expect(harness.faux.state.callCount).toBe(1);
	});

	it("blocks tools requested by an in-flight model after the soft budget expires", async () => {
		const requested = gate();
		const release = gate();
		const execute = vi.fn(async () => ({
			content: [{ type: "text" as const, text: "must not execute" }],
			details: {},
		}));
		harness = await createHarness({
			extensionFactories: [
				(pi) => {
					pi.registerTool({
						name: "external",
						label: "external",
						description: "synthetic",
						parameters: Type.Object({}),
						execute,
					});
				},
			],
		});
		harness.setResponses([
			async () => {
				requested.resolve();
				await release.promise;
				return fauxAssistantMessage([fauxToolCall("external", {})], { stopReason: "toolUse" });
			},
		]);
		vi.useFakeTimers();
		const handle = start(harness, { softDeadlineMs: 500, hardDeadlineMs: 1000 });
		await requested.promise;
		await vi.advanceTimersByTimeAsync(500);
		expect(handle.snapshot().phase).toBe("draining");
		expect(handle.checkpoint({ waitingReason: "runtime drained without model bookkeeping" })).toBeTruthy();
		release.resolve();
		await vi.runAllTimersAsync();
		expect(await handle.settled).toMatchObject({
			execution: "deferred",
			reason: "soft_deadline",
			effectStatus: "none-observed",
		});
		expect(execute).not.toHaveBeenCalled();
		expect(harness.faux.state.callCount).toBe(1);
	});

	it("does not retry quota exhaustion and also caps distinct transient errors at three extra requests", async () => {
		harness = await createHarness({ settings: { retry: { baseDelayMs: 1 }, compaction: { enabled: false } } });
		harness.setResponses([fauxAssistantMessage("", { stopReason: "error", errorMessage: "429 insufficient_quota" })]);
		vi.useFakeTimers();
		const quota = start(harness);
		await vi.runAllTimersAsync();
		expect(await quota.settled).toMatchObject({ execution: "failed" });
		expect(harness.faux.state.callCount).toBe(1);
		await harness.session.waitForIdle();
		harness.setResponses(
			Array.from({ length: 56 }, (_, index) =>
				fauxAssistantMessage("", { stopReason: "error", errorMessage: `503 overloaded: failure-${index}` }),
			),
		);
		const distinct = start(harness);
		await vi.runAllTimersAsync();
		expect(await distinct.settled).toMatchObject({ execution: "deferred" });
		expect(harness.faux.state.callCount).toBe(5);
	});

	it("keeps the accepted hard elapsed budget after a wall-clock jump", async () => {
		const requested = gate();
		const release = gate();
		harness = await createHarness();
		harness.setResponses([
			async () => {
				requested.resolve();
				await release.promise;
				return fauxAssistantMessage("late");
			},
		]);
		vi.useFakeTimers();
		const handle = start(harness, { softDeadlineMs: 500, hardDeadlineMs: 1000 });
		await requested.promise;
		const original = handle.snapshot().hardDeadlineAt;
		vi.setSystemTime(Date.now() - 86_400_000);
		await vi.advanceTimersByTimeAsync(1000);
		expect(handle.snapshot()).toMatchObject({ phase: "cancelling", hardDeadlineAt: original });
		release.resolve();
		await vi.runAllTimersAsync();
		expect(await handle.settled).toMatchObject({ execution: "cancelled", reason: "hard_deadline" });
	});

	it("suppresses SDK cache warming only for the accepted scheduled run", async () => {
		harness = await createHarness({
			settings: { cacheWarming: "streaming", retry: { provider: { maxRetries: 2 } } },
		});
		const warming = vi.spyOn(CacheWarmer.prototype, "start");
		const sdk = await createAgentSession({
			model: harness.getModel(),
			modelRuntime: harness.session.modelRuntime,
			settingsManager: harness.settingsManager,
			resourceLoader: harness.session.resourceLoader,
			sessionManager: SessionManager.inMemory(harness.tempDir),
		});
		try {
			const providerRetries: Array<number | undefined> = [];
			harness.setResponses([
				(_context, options) => {
					providerRetries.push(options?.maxRetries);
					return fauxAssistantMessage("scheduled done");
				},
				(_context, options) => {
					providerRetries.push(options?.maxRetries);
					return fauxAssistantMessage("ordinary done");
				},
			]);
			const accepted = sdk.session.scheduledExecution.start({
				binding: {
					jobId: "job",
					attemptId: "attempt",
					ownerSessionId: sdk.session.sessionId,
					ownerEpoch: 1,
					revision: 1,
				},
				policy: { softDeadlineMs: 20_000, hardDeadlineMs: 30_000 },
				content: "authorized fixture",
			});
			if (!accepted.accepted) throw new Error(accepted.reason);
			await accepted.handle.settled;
			await sdk.session.waitForIdle();
			expect(warming).not.toHaveBeenCalled();
			await sdk.session.prompt("ordinary");
			expect(warming).toHaveBeenCalledOnce();
			expect(providerRetries).toEqual([0, 2]);
			expect(harness.settingsManager.getCacheWarmingMode()).toBe("streaming");
		} finally {
			sdk.session.dispose();
			warming.mockRestore();
		}
	});

	it("bounds checkpoint declarations and never upgrades declared effects into known success", async () => {
		const requested = gate();
		const release = gate();
		harness = await createHarness();
		harness.setResponses([
			async () => {
				requested.resolve();
				await release.promise;
				return fauxAssistantMessage("done");
			},
		]);
		const handle = start(harness);
		await requested.promise;
		const invalid = { artifacts: [{ ref: "tmp/fixture", unexpectedPayload: "not metadata" }] };
		expect(() => handle.checkpoint(invalid)).toThrow("artifact");
		handle.checkpoint({ effects: [{ id: "synthetic-effect", scope: "synthetic-channel", evidenceRefs: [] }] });
		expect(() =>
			handle.checkpoint({ effects: [{ id: "synthetic-effect", scope: "different-channel", evidenceRefs: [] }] }),
		).toThrow("effect scope");
		const retained = handle.checkpoint({ nextAction: "Read-only reconciliation", effects: [] });
		expect(harness.sessionManager.getEntry(retained)).toMatchObject({
			type: "custom",
			data: { declarations: { effects: [{ id: "synthetic-effect", scope: "synthetic-channel" }] } },
		});
		release.resolve();
		expect(await handle.settled).toMatchObject({
			execution: "completed",
			effectStatus: "unknown",
			businessOutcome: "unverified",
		});
	});

	it("keeps extension stop commands immediate instead of queueing them behind scheduled work", async () => {
		const requested = gate();
		const release = gate();
		harness = await createHarness({
			extensionFactories: [
				(pi) => {
					pi.registerCommand("stop_fixture", {
						handler: async (_args, ctx) => {
							ctx.scheduledExecution!.active!.requestCancel("user_stop_command");
						},
					});
				},
			],
		});
		harness.setResponses([
			async () => {
				requested.resolve();
				await release.promise;
				return fauxAssistantMessage("late");
			},
		]);
		const handle = start(harness);
		await requested.promise;
		await harness.session.prompt("/stop_fixture");
		expect(handle.snapshot()).toMatchObject({ phase: "cancelling", reason: "user_stop_command" });
		release.resolve();
		expect(await handle.settled).toMatchObject({ execution: "cancelled" });
	});

	it("materializes metadata before inference and preserves a pre-request drain checkpoint on disk", async () => {
		harness = await createHarness();
		const manager = SessionManager.create(harness.tempDir, join(harness.tempDir, "scheduled-session"));
		const file = manager.getSessionFile()!;
		expect(existsSync(file)).toBe(false);
		const sdk = await createAgentSession({
			model: harness.getModel(),
			modelRuntime: harness.session.modelRuntime,
			settingsManager: harness.settingsManager,
			resourceLoader: harness.session.resourceLoader,
			sessionManager: manager,
		});
		try {
			const accepted = sdk.session.scheduledExecution.start({
				binding: {
					jobId: "fresh-job",
					attemptId: "fresh-attempt",
					ownerSessionId: sdk.session.sessionId,
					ownerEpoch: 1,
					revision: 1,
				},
				policy: { softDeadlineMs: 20_000, hardDeadlineMs: 30_000 },
				content: "authorized synthetic occurrence",
			});
			if (!accepted.accepted) throw new Error(accepted.reason);
			accepted.handle.requestDrain("before_first_request");
			expect(existsSync(file)).toBe(true);
			const receipt = await accepted.handle.settled;
			expect(harness.faux.state.callCount).toBe(0);
			const reopened = SessionManager.open(file);
			expect(reopened.getEntry(receipt.checkpointEntryId)).toMatchObject({
				type: "custom",
				customType: SCHEDULED_CHECKPOINT_ENTRY,
				data: { completedResultCount: 0 },
			});
			expect(
				reopened
					.getEntries()
					.some((entry) => entry.type === "custom" && entry.customType === SCHEDULED_RECEIPT_ENTRY),
			).toBe(true);
		} finally {
			sdk.session.dispose();
		}
	});

	it("records a failed real pre-settle boundary as interrupted before releasing the exact native handle", async () => {
		let failBoundary = true;
		harness = await createHarness({
			settings: { compaction: { enabled: false } },
			extensionFactories: [
				(pi) => {
					pi.on("agent_before_settle", () =>
						failBoundary
							? { entries: [{ type: "custom", customType: "synthetic-boundary", data: { fixture: true } }] }
							: undefined,
					);
				},
			],
		});
		const append = harness.sessionManager.appendCustomEntry.bind(harness.sessionManager);
		vi.spyOn(harness.sessionManager, "appendCustomEntry").mockImplementation((type, data) => {
			if (type === "synthetic-boundary") throw new Error("synthetic boundary persistence failure");
			return append(type, data);
		});
		harness.setResponses([fauxAssistantMessage("model completed; boundary still pending")]);
		const handle = start(harness);
		const receipt = await handle.settled;
		await harness.session.waitForIdle();
		expect(receipt).toMatchObject({
			execution: "interrupted",
			reason: "native_execution_failed",
			businessOutcome: "unverified",
		});
		expect(harness.faux.state.callCount).toBe(1);
		expect(harness.session.isIdle).toBe(true);
		expect(harness.sessionManager.getEntry(receipt.checkpointEntryId)).toMatchObject({
			type: "custom",
			customType: SCHEDULED_CHECKPOINT_ENTRY,
		});
		const receipts = harness.sessionManager
			.getEntries()
			.filter((entry) => entry.type === "custom" && entry.customType === SCHEDULED_RECEIPT_ENTRY);
		expect(receipts).toHaveLength(1);
		expect(receipts[0]).toMatchObject({ type: "custom", data: { execution: "interrupted" } });
		expect(handle.requestCancel()).toBe(false);
		failBoundary = false;
		harness.setResponses([fauxAssistantMessage("ordinary turn remains available")]);
		await harness.session.prompt("ordinary continuation, not a scheduled replay");
		expect(harness.session.getLastAssistantText()).toBe("ordinary turn remains available");
	});

	it("keeps ordinary pre-settle boundary failures observable as rejected prompts", async () => {
		harness = await createHarness({
			extensionFactories: [
				(pi) => {
					pi.on("agent_before_settle", () => ({
						entries: [{ type: "custom", customType: "synthetic-boundary", data: {} }],
					}));
				},
			],
		});
		const append = harness.sessionManager.appendCustomEntry.bind(harness.sessionManager);
		vi.spyOn(harness.sessionManager, "appendCustomEntry").mockImplementation((type, data) => {
			if (type === "synthetic-boundary") throw new Error("synthetic ordinary boundary failure");
			return append(type, data);
		});
		harness.setResponses([fauxAssistantMessage("ordinary model stop")]);
		await expect(harness.session.prompt("ordinary fixture")).rejects.toThrow("synthetic ordinary boundary failure");
		expect(harness.session.isIdle).toBe(true);
		expect(
			harness.sessionManager
				.getEntries()
				.some((entry) => entry.type === "custom" && entry.customType === SCHEDULED_RECEIPT_ENTRY),
		).toBe(false);
	});

	it("classifies only the actual shipped builtin read implementation as free of unknown write effects", async () => {
		harness = await createHarness();
		const file = join(harness.tempDir, "read-only-fixture.txt");
		writeFileSync(file, "synthetic readable artifact");
		harness.setResponses([
			fauxAssistantMessage([fauxToolCall("read", { path: file })], { stopReason: "toolUse" }),
			fauxAssistantMessage("read returned"),
		]);
		const handle = start(harness);
		expect(await handle.settled).toMatchObject({
			execution: "completed",
			effectStatus: "none-observed",
			businessOutcome: "unverified",
		});
		expect(
			harness.session.messages.some(
				(message) => message.role === "toolResult" && message.toolName === "read" && !message.isError,
			),
		).toBe(true);
	});

	it("does not trust an overridden read name or readOnlyHint annotation", async () => {
		const execute = vi.fn(async () => ({
			content: [{ type: "text" as const, text: "custom code is not verified readonly" }],
			details: {},
		}));
		harness = await createHarness({
			extensionFactories: [
				(pi) => {
					pi.registerTool({
						name: "read",
						label: "read",
						description: "custom read",
						parameters: Type.Object({}),
						annotations: { readOnlyHint: true },
						execute,
					});
				},
			],
		});
		harness.setResponses([
			fauxAssistantMessage([fauxToolCall("read", {})], { stopReason: "toolUse" }),
			fauxAssistantMessage("custom returned"),
		]);
		const handle = start(harness);
		expect(await handle.settled).toMatchObject({ execution: "completed", effectStatus: "unknown" });
		expect(execute).toHaveBeenCalledOnce();
	});

	it("detects an SDK executable replacement even if the old builtin declaration stays registered", async () => {
		harness = await createHarness();
		const replacement = vi.fn(async () => ({
			content: [{ type: "text" as const, text: "unverified replacement" }],
			details: {},
		}));
		harness.setResponses([
			() => {
				const read = harness!.session.agent.state.tools.find((tool) => tool.name === "read");
				if (!read) throw new Error("No builtin declaration");
				read.execute = replacement;
				return fauxAssistantMessage([fauxToolCall("read", { path: "synthetic-not-read" })], {
					stopReason: "toolUse",
				});
			},
			fauxAssistantMessage("replacement returned"),
		]);
		const handle = start(harness);
		expect(await handle.settled).toMatchObject({ execution: "completed", effectStatus: "unknown" });
		expect(replacement).toHaveBeenCalledOnce();
	});

	it("does not treat an SDK baseToolsOverride as a shipped builtin implementation", async () => {
		const execute = vi.fn(async () => ({
			content: [{ type: "text" as const, text: "unverified SDK base tool" }],
			details: {},
		}));
		harness = await createHarness({
			tools: [{ name: "read", label: "read", description: "SDK replacement", parameters: Type.Object({}), execute }],
		});
		harness.setResponses([
			fauxAssistantMessage([fauxToolCall("read", {})], { stopReason: "toolUse" }),
			fauxAssistantMessage("replacement returned"),
		]);
		const handle = start(harness);
		expect(await handle.settled).toMatchObject({ execution: "completed", effectStatus: "unknown" });
		expect(execute).toHaveBeenCalledOnce();
	});

	it("does not admit a replacement when durable checkpoint persistence failed", async () => {
		harness = await createHarness();
		const append = harness.sessionManager.appendCustomEntry.bind(harness.sessionManager);
		vi.spyOn(harness.sessionManager, "appendCustomEntry").mockImplementation((type, data) => {
			if (type === SCHEDULED_RECEIPT_ENTRY) throw new Error("synthetic disk failure");
			return append(type, data);
		});
		harness.setResponses([fauxAssistantMessage("native ended")]);
		const handle = start(harness);
		await vi.waitFor(() => expect(handle.snapshot().phase).toBe("attention-required"));
		expect(harness.session.isIdle).toBe(false);
		expect(() => start(harness!)).toThrow("busy");
		expect(harness.faux.state.callCount).toBe(1);
	});
});
