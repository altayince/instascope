# GitHub repository setup

- Public repository: https://github.com/altayince/instascope (visibility and open Issues verified for INS-85). Public problem reports use the `bug_report.yml` issue form; the INS Project below remains private.
- Private Project: https://github.com/users/altayince/projects/3 (`INS`)
- Implementation issue: #1, assigned to `altayince`, in INS.
- Branch: `feature/INS-1-privacy-first-mvp`, created from updated `main`.
- Implementation PR: https://github.com/altayince/instascope/pull/2, assigned to `altayince` and added to INS.
- Only the initial empty bootstrap commit was pushed directly to main.
- Required checks: `quality`, `browser-tests`, `validate-branch`, `validate-ownership`.
- Main protection was applied and read back successfully: admins enforced, strict/up-to-date checks, required PR, zero mandatory approving reviews, linear history, conversation resolution, no force-push or deletion.
- Squash/rebase merges enabled, merge commits disabled, merged branch deletion enabled.
- Local `.githooks/pre-push` installed. Git's per-command safe.directory is used in this sandbox because the workspace and Git directory have different Windows owners; no broad global trust exception was added.
- `INS_PROJECT_TOKEN` configured from the existing authorized GitHub CLI credential as an encrypted Actions secret. Value never written to disk or committed. Rotate when that authorization changes.
- Ownership validation checks BOTH issue and PR assignee/Project membership and executes no checked-out code.
- INS-124 policy: only actually merged, same-repository INS task PRs targeting
  `main` or `dev` close their issue as `completed`. Unmerged closed PRs leave the
  issue open. Invalid tickets, nonexistent issues, PR numbers and forks cannot
  cause an issue write. The closure job requests only `issues: write` and reads
  event metadata; it checks out and executes no PR code.

## Issue closure event source and rollout (INS-124)

GitHub's [December 2025 event change](https://github.blog/changelog/2025-11-07-actions-pull_request_target-and-environment-branch-protections-changes/)
makes `pull_request_target` use the default branch's workflow even when the PR
targets another branch. This repository's default is `main`. At the INS-124 audit,
main's closure workflow filtered only `[main]`; dev's `[main, dev]` edit therefore
did not handle dev merges. The latest recorded closure run was [main PR #113](https://github.com/altayince/instascope/actions/runs/38387484860);
five later dev merges, including PR #123, had no closure workflow run.

The replacement uses GitHub's documented [closed pull-request event with a merged guard](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#running-your-pull_request-workflow-when-a-pull_request-merges).
A merged `pull_request` event runs against its target branch, so installing this
replacement on `dev` enables dev closure without changing the default branch.
The INS branch number remains the source of the issue reference: GitHub's native
`Fixes #…` closing behavior only operates on default-branch merges.

**Rollout limitation:** this PR targets `dev` and is not merged by the agent.
Until an infrastructure-only copy of this patch is separately reviewed and
landed on `main`, main's legacy `pull_request_target` workflow remains active and
can still close an unmerged main PR's issue as `not_planned`. Proposed workflow
tests cover both bases; they are not a claim that live main behavior changed.
No main PR, merge, deployment, manual issue repair or live test merge is performed
as part of this task.

The local GitHub connector returned no repositories; GitHub CLI was used with the user's existing authorized account.
