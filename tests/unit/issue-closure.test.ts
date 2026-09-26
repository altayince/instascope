import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

// Execute the actual inline workflow script against a synthetic GitHub API.
const workflow = readFileSync(
  ".github/workflows/close-linked-issue.yml",
  "utf8",
).replaceAll("\r\n", "\n");
const source = workflow
  .split("script: |\n")[1]
  .split("\n")
  .map((line) => line.slice(12))
  .join("\n");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
async function run({
  merged = false,
  branch = "feature/INS-42-synthetic-task",
  repo = "owner/repo",
  action = "closed",
  issue = { state: "open" } as Record<string, unknown>,
} = {}) {
  const get = vi.fn().mockResolvedValue({ data: issue });
  const update = vi.fn();
  const setFailed = vi.fn();
  await new AsyncFunction("github", "core", "context", source)(
    { rest: { issues: { get, update } } },
    { setFailed },
    {
      repo: { owner: "owner", repo: "repo" },
      payload: {
        action,
        pull_request: {
          merged,
          head: { ref: branch, repo: { full_name: repo } },
          base: { ref: "main" },
        },
      },
    },
  );
  return { get, update, setFailed };
}
describe("closed task PR issue policy", () => {
  it.each([true, false])(
    "closes merged=%s using the branch's issue number",
    async (merged) => {
      const { update, setFailed } = await run({ merged });
      expect(update).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        issue_number: 42,
        state: "closed",
        state_reason: merged ? "completed" : "not_planned",
      });
      expect(setFailed).not.toHaveBeenCalled();
    },
  );
  it("does not act on fork PRs or non-closure events", async () => {
    for (const args of [{ repo: "fork/repo" }, { action: "opened" }])
      expect((await run(args)).get).not.toHaveBeenCalled();
  });
  it("rejects invalid ticket branches and PRs used as issue numbers", async () => {
    for (const args of [
      { branch: "main" },
      { issue: { state: "open", pull_request: {} } },
    ]) {
      const result = await run(args);
      expect(result.update).not.toHaveBeenCalled();
      expect(result.setFailed).toHaveBeenCalledOnce();
    }
  });
  it("is idempotent for issues already closed by GitHub", async () => {
    expect(
      (await run({ issue: { state: "closed" } })).update,
    ).not.toHaveBeenCalled();
  });
});
