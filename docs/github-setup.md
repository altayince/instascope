# GitHub repository setup

- Private repository: https://github.com/altayince/instascope
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
- The merge-only linked-issue closer retains the GLA/MUZ behavior. Unmerged PR closure leaves the issue open.

The local GitHub connector returned no repositories; GitHub CLI was used with the user's existing authorized account.
