// Native scheduled-run identity, finite policy, checkpoints and exact closure; never an execution or retry loop.
import { randomUUID } from "node:crypto";
import type { AssistantMessage, RetryPolicy } from "@earendil-works/pi-ai";

/** Opaque runtime identity. Serialized IDs are evidence, not authority to control another run. */
export type ScheduledRunId = string & { readonly scheduledRunId: unique symbol };

/** The scheduler's accepted ownership/configuration, independent of model-provided message details. */
export interface ScheduledRunBinding {
	jobId: string;
	attemptId: string;
	ownerSessionId: string;
	ownerEpoch: number;
	revision: number;
}

/** Explicit elapsed budgets; cadence never appears here. Retry policy applies only to this run. */
export interface ScheduledRunPolicy {
	softDeadlineMs: number;
	hardDeadlineMs: number;
	recoveryBudgetMs?: number;
	retry?: Partial<Omit<RetryPolicy, "enabled">>;
}

/** Artifact/effect declarations are unverified metadata, never execution or business-completion proof. */
export interface ScheduledCheckpointDeclaration {
	artifacts?: Array<{ ref: string; sha256?: string }>;
	effects?: Array<{ id: string; scope: string; evidenceRefs: string[] }>;
	nextAction?: string;
	waitingReason?: string;
}

export interface ScheduledResultReference {
	entryId: string;
	toolCallId: string;
	toolName: string;
	isError: boolean;
}

/** Bounded references into the authoritative native transcript, without copying tool payloads. */
export interface ScheduledRunCheckpoint {
	version: 1;
	runId: ScheduledRunId;
	binding: ScheduledRunBinding;
	createdAt: string;
	completedResults: ScheduledResultReference[];
	completedResultCount: number;
	lastResultEntryId?: string;
	declarations: ScheduledCheckpointDeclaration;
	effectStatus: "none-observed" | "unknown";
	businessOutcome: "unverified";
}

export type ScheduledRunPhase = "running" | "draining" | "cancelling" | "settled" | "attention-required";

/** Read-only observation. Activity/requests are not business progress. */
export interface ScheduledRunSnapshot {
	runId: ScheduledRunId;
	binding: ScheduledRunBinding;
	phase: ScheduledRunPhase;
	reason?: string;
	startedAt: string;
	softDeadlineAt: string;
	hardDeadlineAt: string;
	nativeClosed: boolean;
	ownedHandles: string[];
	requestCount: number;
	retryCount: number;
	failedRecoveryMs: number;
	providerPhase: "unknown" | "request-started" | "response-received";
	retryNotBefore?: string;
	checkpointEntryId?: string;
}

/** A persisted exit acknowledgement, not a claim that external effects succeeded or rolled back. */
export interface ScheduledRunReceipt {
	version: 1;
	runId: ScheduledRunId;
	binding: ScheduledRunBinding;
	finishedAt: string;
	execution: "completed" | "failed" | "deferred" | "cancelled" | "interrupted";
	reason?: string;
	checkpointEntryId: string;
	effectStatus: "none-observed" | "unknown";
	businessOutcome: "unverified";
	failedRecoveryMs: number;
	retryNotBefore?: string;
}

/** Control is bound to the returned handle, never a session-wide abort or an untrusted run ID. */
export interface ScheduledRunHandle {
	readonly runId: ScheduledRunId;
	readonly settled: Promise<ScheduledRunReceipt>;
	snapshot(): ScheduledRunSnapshot;
	checkpoint(declaration?: ScheduledCheckpointDeclaration): string;
	requestDrain(reason?: string): boolean;
	requestCancel(reason?: string): boolean;
	/** Hold the slot until this explicitly owned operation actually closes, including after cancellation. */
	own(handle: { id: string; closed: Promise<void>; cancel?: () => void }): void;
}

export interface ScheduledExecutionRequest {
	binding: ScheduledRunBinding;
	policy: ScheduledRunPolicy;
	content: string;
}

/** An additive capability. Absence or a different version must be refused before resilient admission. */
export interface ScheduledExecutionCapability {
	readonly version: 1;
	readonly active: ScheduledRunHandle | undefined;
	start(
		request: ScheduledExecutionRequest,
	): { accepted: true; handle: ScheduledRunHandle } | { accepted: false; reason: "busy" | "disposed" };
}

export const SCHEDULED_CHECKPOINT_ENTRY = "pi.scheduled-checkpoint.v1";
export const SCHEDULED_RECEIPT_ENTRY = "pi.scheduled-receipt.v1";

interface ScheduledExecutionHost {
	sessionId: string;
	isIdle(): boolean;
	execute(request: ScheduledExecutionRequest, runId: ScheduledRunId): Promise<void>;
	abort(): void;
	interruptRetry(): void;
	persist(type: string, data: unknown): string;
	onError(error: unknown): void;
}

interface RunState {
	request: ScheduledExecutionRequest;
	handle: ScheduledRunHandle;
	phase: ScheduledRunPhase;
	reason?: string;
	startedAt: number;
	startedMonotonic: number;
	nativeClosed: boolean;
	owned: Map<string, { closed: Promise<void>; cancel?: () => void }>;
	ownedFailure: boolean;
	softTimer?: ReturnType<typeof setTimeout>;
	hardTimer?: ReturnType<typeof setTimeout>;
	requestCount: number;
	retryCount: number;
	failedRecoveryMs: number;
	providerPhase: ScheduledRunSnapshot["providerPhase"];
	retryNotBefore?: number;
	results: ScheduledResultReference[];
	resultCount: number;
	startedTool: boolean;
	declarations: ScheduledCheckpointDeclaration;
	checkpointEntryId?: string;
	lastStopReason?: AssistantMessage["stopReason"];
	resolve(receipt: ScheduledRunReceipt): void;
}

/** Session-owned bookkeeping behind the native capability; AgentSession alone drives execution/settlement. */
export class ScheduledExecutionController implements ScheduledExecutionCapability {
	readonly version = 1;
	private host: ScheduledExecutionHost;
	private run?: RunState;
	private disposed = false;

	constructor(host: ScheduledExecutionHost) {
		this.host = host;
	}

	get active(): ScheduledRunHandle | undefined {
		return this.run?.handle;
	}
	get shouldStop(): boolean {
		return this.run !== undefined && this.run.phase !== "running";
	}

	start(request: ScheduledExecutionRequest): ReturnType<ScheduledExecutionCapability["start"]> {
		if (this.disposed) return { accepted: false, reason: "disposed" };
		if (this.run || !this.host.isIdle()) return { accepted: false, reason: "busy" };
		validateRequest(request, this.host.sessionId);
		// The accepted values cannot subsequently be enlarged by a caller mutating its configuration object.
		const accepted = structuredClone(request);
		const runId = randomUUID() as ScheduledRunId;
		let resolve!: RunState["resolve"];
		const settled = new Promise<ScheduledRunReceipt>((done) => {
			resolve = done;
		});
		const run: RunState = {
			request: accepted,
			phase: "running",
			startedAt: Date.now(),
			startedMonotonic: performance.now(),
			nativeClosed: false,
			owned: new Map(),
			ownedFailure: false,
			requestCount: 0,
			retryCount: 0,
			failedRecoveryMs: 0,
			providerPhase: "unknown",
			results: [],
			resultCount: 0,
			startedTool: false,
			declarations: {},
			resolve,
			handle: {
				runId,
				settled,
				snapshot: () => this.snapshot(run),
				checkpoint: (declaration) => this.checkpoint(run, declaration),
				requestDrain: (reason = "drain_requested") => this.drain(run, reason),
				requestCancel: (reason = "cancel_requested") => this.cancel(run, reason),
				own: (handle) => this.own(run, handle),
			},
		};
		// Reserve before persistence emits entry listeners; those listeners may synchronously request another run.
		this.run = run;
		run.softTimer = setTimeout(() => this.drain(run, "soft_deadline"), accepted.policy.softDeadlineMs);
		run.hardTimer = setTimeout(() => this.cancel(run, "hard_deadline"), accepted.policy.hardDeadlineMs);
		try {
			this.host.persist("pi.scheduled-start.v1", {
				runId,
				binding: { ...accepted.binding },
				policy: structuredClone(accepted.policy),
				startedAt: new Date(run.startedAt).toISOString(),
			});
		} catch (error) {
			clearTimeout(run.softTimer);
			clearTimeout(run.hardTimer);
			this.run = undefined;
			throw error;
		}
		void this.host
			.execute(accepted, runId)
			.catch(async (error: unknown) => {
				this.host.onError(error);
				if (this.run === run && !run.nativeClosed) await this.finishNative("start_failed");
			})
			.catch((error: unknown) => {
				this.host.onError(error);
			});
		return { accepted: true, handle: run.handle };
	}

	private snapshot(run: RunState): ScheduledRunSnapshot {
		return {
			runId: run.handle.runId,
			binding: { ...run.request.binding },
			phase: run.phase,
			reason: run.reason,
			startedAt: new Date(run.startedAt).toISOString(),
			softDeadlineAt: new Date(run.startedAt + run.request.policy.softDeadlineMs).toISOString(),
			hardDeadlineAt: new Date(run.startedAt + run.request.policy.hardDeadlineMs).toISOString(),
			nativeClosed: run.nativeClosed,
			ownedHandles: [...run.owned.keys()],
			requestCount: run.requestCount,
			retryCount: run.retryCount,
			failedRecoveryMs: run.failedRecoveryMs,
			providerPhase: run.providerPhase,
			retryNotBefore: run.retryNotBefore === undefined ? undefined : new Date(run.retryNotBefore).toISOString(),
			checkpointEntryId: run.checkpointEntryId,
		};
	}

	private drain(run: RunState, reason: string): boolean {
		if (this.run !== run || run.phase === "cancelling" || run.phase === "attention-required") return false;
		if (run.phase === "running") {
			run.phase = "draining";
			run.reason = reason;
		}
		this.host.interruptRetry();
		return true;
	}

	private cancel(run: RunState, reason: string): boolean {
		if (this.run !== run || run.phase === "attention-required") return false;
		if (run.phase === "cancelling") return true;
		run.phase = "cancelling";
		run.reason = reason;
		if (!run.nativeClosed) this.host.abort();
		for (const owned of run.owned.values()) {
			try {
				owned.cancel?.();
			} catch (error) {
				this.host.onError(error);
			}
		}
		return true;
	}

	private own(run: RunState, handle: { id: string; closed: Promise<void>; cancel?: () => void }): void {
		if (this.run !== run || run.nativeClosed) throw new Error("Cannot attach work to a closed scheduled native run");
		if (!handle.id || run.owned.has(handle.id)) throw new Error("Owned handle identity must be nonempty and unique");
		const closed = handle.closed.then(
			() => {
				run.owned.delete(handle.id);
			},
			() => {
				run.ownedFailure = true;
				run.owned.delete(handle.id);
			},
		);
		run.owned.set(handle.id, { closed, cancel: handle.cancel });
		if (run.phase === "cancelling") handle.cancel?.();
	}

	private checkpoint(run: RunState, declaration?: ScheduledCheckpointDeclaration): string {
		if (this.run !== run) throw new Error("Cannot change a settled scheduled checkpoint");
		if (declaration !== undefined) {
			validateDeclaration(declaration);
			const artifacts = [...(run.declarations.artifacts ?? [])];
			for (const artifact of declaration.artifacts ?? []) {
				if (!artifacts.some((prior) => prior.ref === artifact.ref && prior.sha256 === artifact.sha256))
					artifacts.push({ ...artifact });
			}
			const effects = new Map((run.declarations.effects ?? []).map((effect) => [effect.id, effect]));
			for (const effect of declaration.effects ?? []) {
				const prior = effects.get(effect.id);
				if (prior && prior.scope !== effect.scope) throw new Error("Cannot redefine an unresolved effect scope");
				effects.set(effect.id, {
					...effect,
					evidenceRefs: [...new Set([...(prior?.evidenceRefs ?? []), ...effect.evidenceRefs])],
				});
			}
			const next = {
				...run.declarations,
				...structuredClone(declaration),
				artifacts,
				effects: [...effects.values()],
			};
			// A later declaration may add evidence, never silently erase earlier unknown effects or artifacts.
			validateDeclaration(next);
			run.declarations = next;
		}
		const checkpoint: ScheduledRunCheckpoint = {
			version: 1,
			runId: run.handle.runId,
			binding: { ...run.request.binding },
			createdAt: new Date().toISOString(),
			completedResults: run.results.slice(),
			completedResultCount: run.resultCount,
			lastResultEntryId: run.results.at(-1)?.entryId,
			declarations: structuredClone(run.declarations),
			effectStatus: run.startedTool || (run.declarations.effects?.length ?? 0) > 0 ? "unknown" : "none-observed",
			businessOutcome: "unverified",
		};
		run.checkpointEntryId = this.host.persist(SCHEDULED_CHECKPOINT_ENTRY, checkpoint);
		return run.checkpointEntryId;
	}

	/** Record only result entries that the session has actually appended. */
	recordResult(result: ScheduledResultReference): void {
		const run = this.run;
		if (!run) return;
		run.results.push(result);
		run.resultCount++;
		if (run.results.length > 256) run.results.shift();
	}

	/** Record execution, not business progress or evidence that a tool was effect-free. */
	recordToolStart(): void {
		if (this.run) this.run.startedTool = true;
	}
	recordAssistant(message: AssistantMessage): void {
		if (this.run) this.run.lastStopReason = message.stopReason;
	}

	/** Use the existing native retry algorithm with this run's finite overrides. */
	retryPolicy(fallback: RetryPolicy): RetryPolicy {
		return this.run
			? {
					...fallback,
					enabled: true,
					maxRetries: 3,
					maxConsecutiveSameErrorRetries: 3,
					...this.run.request.policy.retry,
				}
			: fallback;
	}

	/** Start one native model request. A rejected boundary must not call a provider. */
	beginRequest(): { run: RunState; started: number } | undefined {
		const run = this.run;
		if (!run) return undefined;
		if (this.shouldStop || !this.canRetry(0)) {
			this.drain(run, "recovery_budget_exhausted");
			throw new Error("Scheduled run reached a safe stop boundary; no provider request was sent");
		}
		run.requestCount++;
		run.providerPhase = "request-started";
		run.retryNotBefore = undefined;
		return { run, started: performance.now() };
	}

	/** Consume real response headers only; absent provider phase information remains unknown. */
	observeResponse(request: { run: RunState }, status: number, headers: Record<string, string>): void {
		const run = request.run;
		if (this.run !== run) return;
		run.providerPhase = "response-received";
		const value = Object.entries(headers).find(([key]) => key.toLowerCase() === "retry-after")?.[1];
		if (status < 400 || value === undefined) return;
		const seconds = Number(value);
		const at = Number.isFinite(seconds) ? Date.now() + Math.max(0, seconds * 1000) : Date.parse(value);
		if (Number.isFinite(at)) run.retryNotBefore = Math.max(Date.now(), at);
	}

	/** Failed-call time is cumulative; successful model reasoning never replenishes or spends it. */
	endRequest(request: { run: RunState; started: number }, failed: boolean): void {
		if (failed) request.run.failedRecoveryMs += Math.max(0, performance.now() - request.started);
	}

	retryDelay(delay: number): number {
		return Math.max(delay, (this.run?.retryNotBefore ?? Date.now()) - Date.now());
	}

	canRetry(delay: number): boolean {
		const run = this.run;
		if (!run) return true;
		return (
			run.phase === "running" &&
			run.failedRecoveryMs + delay < (run.request.policy.recoveryBudgetMs ?? 300_000) &&
			performance.now() - run.startedMonotonic + delay < run.request.policy.softDeadlineMs
		);
	}

	recordRetryWait(elapsed: number): void {
		if (this.run) {
			this.run.failedRecoveryMs += Math.max(0, elapsed);
			this.run.retryCount++;
		}
	}

	/** Called only after the native loop really ends, before any unrelated settled-handler turn can start. */
	async finishNative(failureReason?: string): Promise<void> {
		const run = this.run;
		if (!run) return;
		run.nativeClosed = true;
		if (failureReason) run.reason = failureReason;
		if (run.owned.size > 0 && run.phase === "running") run.phase = "draining";
		try {
			await Promise.all([...run.owned.values()].map((owned) => owned.closed));
			const checkpointEntryId = this.checkpoint(run);
			const execution: ScheduledRunReceipt["execution"] =
				failureReason || run.ownedFailure
					? "interrupted"
					: run.phase === "cancelling"
						? "cancelled"
						: run.reason
							? "deferred"
							: run.lastStopReason === "error"
								? "failed"
								: run.lastStopReason === "aborted"
									? "cancelled"
									: run.lastStopReason === "stop" || run.lastStopReason === "toolUse"
										? "completed"
										: "interrupted";
			const receipt: ScheduledRunReceipt = {
				version: 1,
				runId: run.handle.runId,
				binding: { ...run.request.binding },
				finishedAt: new Date().toISOString(),
				execution,
				reason: failureReason ?? run.reason ?? (run.ownedFailure ? "owned_handle_failed" : undefined),
				checkpointEntryId,
				effectStatus: run.startedTool || (run.declarations.effects?.length ?? 0) > 0 ? "unknown" : "none-observed",
				businessOutcome: "unverified",
				failedRecoveryMs: run.failedRecoveryMs,
				retryNotBefore: run.retryNotBefore === undefined ? undefined : new Date(run.retryNotBefore).toISOString(),
			};
			this.host.persist(SCHEDULED_RECEIPT_ENTRY, receipt);
			run.reason = receipt.reason;
			run.phase = "settled";
			this.run = undefined;
			run.resolve(receipt);
		} catch (error) {
			// A closed loop without durable acknowledgement is not permission to admit a replacement.
			run.phase = "attention-required";
			run.reason = "checkpoint_persistence_failed";
			throw error;
		} finally {
			clearTimeout(run.softTimer);
			clearTimeout(run.hardTimer);
		}
	}

	dispose(): void {
		this.disposed = true;
		if (this.run) this.cancel(this.run, "session_disposed");
	}
}

function validateRequest(request: ScheduledExecutionRequest, sessionId: string): void {
	const { binding, policy } = request;
	if (
		binding.ownerSessionId !== sessionId ||
		typeof binding.jobId !== "string" ||
		!binding.jobId ||
		binding.jobId.length > 256 ||
		typeof binding.attemptId !== "string" ||
		!binding.attemptId ||
		binding.attemptId.length > 256 ||
		!Number.isSafeInteger(binding.ownerEpoch) ||
		binding.ownerEpoch < 1 ||
		!Number.isSafeInteger(binding.revision) ||
		binding.revision < 1
	)
		throw new Error("Invalid native scheduled ownership binding");
	for (const value of [policy.softDeadlineMs, policy.hardDeadlineMs, policy.recoveryBudgetMs ?? 300_000]) {
		if (!Number.isSafeInteger(value) || value < 1 || value > 86_400_000)
			throw new Error("Scheduled budgets must be finite positive elapsed milliseconds, at most one day");
	}
	if ((policy.recoveryBudgetMs ?? 300_000) > 300_000)
		throw new Error("Scheduled failed-request recovery is limited to five minutes");
	if (policy.softDeadlineMs >= policy.hardDeadlineMs)
		throw new Error("Scheduled soft budget must precede the hard deadline");
	for (const [key, value] of Object.entries(policy.retry ?? {})) {
		if (
			!["maxRetries", "maxConsecutiveSameErrorRetries", "baseDelayMs", "maxAgentDelayMs"].includes(key) ||
			!Number.isSafeInteger(value) ||
			value < 0 ||
			value > (key === "maxRetries" ? 3 : key === "maxConsecutiveSameErrorRetries" ? 3 : 60_000)
		)
			throw new Error("Invalid bounded scheduled retry policy");
		if (key === "maxConsecutiveSameErrorRetries" && value === 0)
			throw new Error("Scheduled equivalent-error guard cannot be disabled");
	}
	if (typeof request.content !== "string" || request.content.length === 0)
		throw new Error("Scheduled content must be nonempty");
}

function validateDeclaration(value: ScheduledCheckpointDeclaration): void {
	if (Object.keys(value).some((key) => !["artifacts", "effects", "nextAction", "waitingReason"].includes(key)))
		throw new Error("Unknown checkpoint declaration field");
	if (
		(value.artifacts !== undefined && !Array.isArray(value.artifacts)) ||
		(value.effects !== undefined && !Array.isArray(value.effects)) ||
		(value.nextAction !== undefined && typeof value.nextAction !== "string") ||
		(value.waitingReason !== undefined && typeof value.waitingReason !== "string") ||
		(value.artifacts?.length ?? 0) > 32 ||
		(value.effects?.length ?? 0) > 32 ||
		(value.nextAction?.length ?? 0) > 2000 ||
		(value.waitingReason?.length ?? 0) > 1000
	)
		throw new Error("Checkpoint declarations exceed metadata bounds");
	for (const artifact of value.artifacts ?? []) {
		if (
			Object.keys(artifact).some((key) => !["ref", "sha256"].includes(key)) ||
			typeof artifact.ref !== "string" ||
			!artifact.ref ||
			artifact.ref.length > 2000 ||
			(artifact.sha256 !== undefined && !/^[a-f0-9]{64}$/.test(artifact.sha256))
		)
			throw new Error("Invalid declared artifact reference/hash");
	}
	for (const effect of value.effects ?? []) {
		if (
			Object.keys(effect).some((key) => !["id", "scope", "evidenceRefs"].includes(key)) ||
			typeof effect.id !== "string" ||
			!effect.id ||
			effect.id.length > 256 ||
			typeof effect.scope !== "string" ||
			!effect.scope ||
			effect.scope.length > 1000 ||
			!Array.isArray(effect.evidenceRefs) ||
			effect.evidenceRefs.length > 32 ||
			effect.evidenceRefs.some((ref) => typeof ref !== "string" || ref.length > 2000)
		)
			throw new Error("Invalid unverified effect declaration");
	}
}
