# INS workflow

InstaScope follows the MUZ/GLA issue-first, task-branch, PR-only workflow.

1. Start with a GitHub issue assigned to `altayince` and added to the private INS Project.
2. Choose the base using the branch-routing rules below, update it with `git pull --ff-only`, then create `feature/INS-<issue>-description` or `bugfix/INS-<issue>-description` from that current base.
3. Develop and test on that branch. Never push feature work directly to `main` or `dev`. The initial empty commit is the sole bootstrap exception.
4. Update `src/app/changelog/page.tsx`: issue number, issue title, short summary, newest first, at most ten entries.
5. Open a PR targeting the chosen base (`main` or `dev`), assign `altayince`, add it to INS, and link the issue with `Fixes #<issue>`.
6. Review the diff, wait for `quality`, `browser-tests`, `validate-branch`, and `validate-ownership`. Merge only after they pass. No second-person approval is required for this single-user project.
7. Only a merged same-repository task PR closes its matching INS issue as completed. A PR closed without merge leaves its issue open. The metadata-only `pull_request` workflow listens for closed events targeting `main` or `dev`, validates the INS branch ticket, and never checks out or executes PR code. See `docs/github-setup.md` for the branch-specific rollout status.

Install hooks after every clone: `powershell -ExecutionPolicy Bypass -File scripts/install-githooks.ps1`.
Local hooks complement server-side protection; they do not replace it.

## Branch routing

`main` is the production line for public InstaScope. Production fixes, SEO,
analytics, infrastructure and other work explicitly intended for production use
`main` -> `feature/INS-*` or `bugfix/INS-*` -> PR targeting `main`.

`dev` is the integration line for unreleased product-family development.
WhatsAppScope currently lives here: update CURRENT `dev`, branch from it, then
open the INS task PR targeting `dev`. Ordinary WhatsAppScope feature PRs must
not target `main`. Issue, ownership, changelog, validation, privacy/security and
no-force-push rules apply on both lines.

`dev` -> `main` is an explicit owner-managed product release, not a normal
feature merge. Coding agents must never merge `dev` into `main` without an
explicit owner instruction to perform that release. Do not deploy production or
change production settings as part of ordinary unreleased feature work.

WhatsAppScope's reviewed repository release state permits intentional production
builds; its pages remain noindex and outside the sitemap until separate SEO work.
Preview/unknown-context protections still apply. Only the owner releases dev to main.
For dev-targeted WhatsAppScope PRs, also require the existing `whatsapp-tests`
and `main-visual-parity` jobs. The same jobs are required for an owner-authorized,
same-repository `feature/INS-<issue>-production-release` PR targeting main, cut
from reviewed dev with current main integrated without rewriting either branch.
Agents prepare that PR for owner review; they do not merge or deploy it.
No production deployment is part of these checks.

The ownership workflow reads private Project metadata using `INS_PROJECT_TOKEN`. This repository secret needs repo and Project read access. Never print or commit the credential. The job must never check out PR code or run scripts from it.

See `docs/github-setup.md` for the actual configured remote state.
