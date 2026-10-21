---
doc_type: runbook
project: workspace
owner_repository: chenhaoxiang/pi
status: active
truth_mode: maintained
created: 2026-10-21
verified: 2026-10-21
verification_scope: Owner-approved protection contract and pre-change platform observation; deployment and controlled PR results recorded separately
owner: chx
ssot: false
---

# Maintained fork branch protection

## Scope and authority

Applies only to `chenhaoxiang/pi`. `main` is the reviewed maintenance branch, not the community
mirror or the installed runtime. The Owner approved this platform rollout on 2026-10-21. It does
not authorize a release, installation, credential change, running-session reload, tag protection,
merge queue, or edits to unrelated forks. See [fork maintenance](fork-maintenance.md).

One human Owner maintains this repository. An independent AI review is engineering evidence,
not a second human approval. Zero platform approval count does not remove the independent
source-review contract. Owner and automation may share an identity; neither receives a permanent
bypass entry. The Owner's ability to manage rules is not proof of an independent actor boundary.

## Desired platform contract

Use repository Rulesets, not overlapping classic protection with different semantics.

| Ref / setting | Required behavior |
|---|---|
| `refs/heads/main` | Active `pi-main-maintenance` ruleset, no exclusions or bypass actors |
| Main updates | Pull request required; no direct push through a normal credential |
| Main history | `deletion` and `non_fast_forward` protections |
| Required checks | Exact `build-check-test` and `mcp-conformance`, both integration ID `15368` (GitHub Actions) |
| Check freshness | `strict_required_status_checks_policy: true`; checks required on creation too |
| Discussions | `required_review_thread_resolution: true` |
| Human approvals | `required_approving_review_count: 0`, no required CODEOWNER or last-push approval |
| Merge method | Only `merge`, both in the PR rule and repository settings; squash/rebase disabled |
| Linear history / queue / deployments / signatures | Not introduced by this rollout |
| `refs/heads/upstream-main` | Separate active `pi-upstream-mirror-history`: deletion + non-fast-forward only, no bypass actors |

The mirror remains a pure community fast-forward stream. Do not impose main's PR/check rules
on it or overwrite divergence. Neither ruleset targets tags, `stable`, or feature branches.
Published tag and asset immutability remain the existing release contract; branch protection
alone does not make release assets immutable.

The approved main pull-request parameters are `allowed_merge_methods:[merge]`,
`dismiss_stale_reviews_on_push:false`, `require_code_owner_review:false`,
`require_last_push_approval:false`, `required_approving_review_count:0`, and
`required_review_thread_resolution:true`. The status-check rule uses `do_not_enforce_on_create:false`.
An administrator is not added as a bypass actor.

## Why only these required checks

`.github/workflows/ci.yml` runs both jobs on every main-targeting PR and on main push, with no
path filters. `build-check-test` already builds/checks/tests; `mcp-conformance` runs the pinned
client compatibility suite. Retain the current workflow content and its model-catalog snapshot.

Do not require scheduled-only `audit`, contributor eligibility, path-filtered Nix/Environments
matrices, or community-only publication jobs as universal PR checks. Missing jobs would block
legitimate PRs; eligibility/publication is not code review. Adding a new required check needs
an actual unconditional PR producer first. An Actions identity binds the reporter, not semantic
trust in workflow contents: workflow/release/lock changes still require independent review.

Strict freshness can rerun CI after another PR merges. This cost is accepted for the low-volume
core maintenance line. Merge queue is not configured: the existing CI has no `merge_group`
trigger. Do not enable linear history while ordinary merge commits are required.

## Rollout and bounded verification

1. Read back repository settings, classic protection, all rulesets, main/mirror effective rules,
   exact default/head and recent real PR checks. Preserve the prior responses outside Git.
2. Prepare exact JSON payloads, reject any unexpected concurrent rule or repository change,
   and independently review the scope before mutation. Use the authenticated GitHub CLI; do
   not print or copy credentials.
3. Create the two scoped rulesets and set only the three approved merge-method fields. If a
   request result is uncertain, read back before any retry; do not create duplicate rulesets.
4. Verify active effective rules, zero bypass, check names/integration, strictness, zero approval
   and mirror-only history protections. Creation success is not enforcement proof.
5. Use this documentation PR as the controlled non-destructive acceptance: observe missing or
   pending required checks block merging, then consume successful results at its exact head
   and merge normally. Never test protection by force-pushing or deleting real main, and never
   use `--admin`, fake checks, a failing production change or a permanent bypass to get green.
6. Read back merged head/merge SHA and the exact main CI, safely refresh canonical main, and
   preserve source-review/CI/configuration evidence before cleaning this task's worktree.

The source contract, GitHub mutation, effective-rule readback, PR blocking observation, successful
merge and post-merge CI are separate evidence layers. Authoring this document does not pre-sign
any of them. Actual rollout IDs and results belong in the associated PR evidence and Meta's
[core registry](https://github.com/tudingaicn/tudingai-meta/blob/main/docs/registries/pi-fork-governance.md).

## Initial observation and recovery

Before this rollout, the 2026-10-21 API readback had default `main` at
`63ead0056453a60eb9e80500865abe5a0e360fca`, `protected:false`, no classic protection and no
repository or inherited effective rulesets. Merge, squash and rebase were all enabled. A real
PR at `c89c94a4ef49bd362612510d44c4aefc48de6076` had the two successful required jobs from
Actions15368. These are preparation-time observations, not a claim that the platform remains so.

Preserve the exact prior responses and new ruleset IDs. If deployment makes normal authorized
work impossible, diagnose the mismatch first. Do not automatically weaken checks or add bypass;
only an Owner-directed recovery may restore the captured settings or modify the affected new
ruleset, with the actual change recorded. Never restore old state over someone else's concurrent
rule changes. No application data, Git history, installed release or active Pi process is changed
by this platform rollout.
