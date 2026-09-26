# Repository rules

Read WORKFLOW.md before making changes. Apply the INS issue/branch/PR flow to every task.
The product specification is docs/PRODUCT_SPEC.md; inspect existing behavior before editing.
Keep parsing, normalization, analysis and UI separate. Never transmit user archives or credentials.
Use synthetic fixtures only. Never commit personal exports, tokens or .env files.
Run npm run check and relevant Playwright tests. Update the issue-numbered changelog.
No direct feature pushes to main, no force pushes, no merging with failing checks.
