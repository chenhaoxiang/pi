/** Canonical maintained release shape shared by runtime and fork packaging. */
export function isMaintainedForkVersion(version: string): boolean {
	return (
		typeof version === "string" &&
		/^(?:0|[1-9]\d{0,5})\.(?:0|[1-9]\d{0,5})\.(?:0|[1-9]\d{0,5})-fork\.[1-9]\d{0,5}$/.test(version.trim())
	);
}
