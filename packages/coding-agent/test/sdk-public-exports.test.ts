import { describe, expect, it } from "vitest";
import * as sdk from "../src/index.ts";

/**
 * The native scheduled capability is additive SDK surface: consumers must be able to detect it
 * before admission. A merge that keeps the runtime but drops the published exports silently
 * breaks that negotiation, so pin the public entry points here.
 */
describe("public SDK exports", () => {
	it("exports the scheduled capability entry names", () => {
		expect(sdk.SCHEDULED_CHECKPOINT_ENTRY).toBe("pi.scheduled-checkpoint.v1");
		expect(sdk.SCHEDULED_RECEIPT_ENTRY).toBe("pi.scheduled-receipt.v1");
	});

	it("keeps the scheduled entry names distinct from ordinary custom entries", () => {
		expect(sdk.SCHEDULED_CHECKPOINT_ENTRY).not.toBe(sdk.SCHEDULED_RECEIPT_ENTRY);
		expect(sdk.SCHEDULED_CHECKPOINT_ENTRY.startsWith("pi.scheduled-")).toBe(true);
		expect(sdk.SCHEDULED_RECEIPT_ENTRY.startsWith("pi.scheduled-")).toBe(true);
	});
});
