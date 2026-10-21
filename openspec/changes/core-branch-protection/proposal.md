# Change: Protect the maintained Pi branches

## Why

Owner approved the recommended minimum platform safeguards after read-only API checks found
main unprotected despite the reviewed-maintenance contract. The shared Owner/AI identity cannot
provide a second-human approval, so real CI and no permanent bypass are the executable boundary.

## What changes

- Main-scoped active Ruleset: PR required, merge-only, discussions resolved, zero human approvals,
  two real Actions checks with strict freshness, no bypass, no deletion/non-fast-forward.
- Mirror-scoped active Ruleset: only deletion/non-fast-forward, preserving ordinary fast-forward.
- Repository merge settings allow only ordinary merge; owner runbook/map and Meta registry record
  the actual state, not inferred runtime or release facts.

## Impact and non-goals

Owner repository is chenhaoxiang/pi; no code, CI workflow, provider, credential, release, installation
or active-session change. No merge queue, tag rules, broad governance rollout or other-fork edits.
Use one controlled documentation PR and effective-rule readback; never force/delete main for testing.
