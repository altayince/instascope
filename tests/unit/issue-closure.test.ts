import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

// Execute the actual workflow code against a synthetic API, never GitHub.
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

interface Scenario {
  merged?: boolean;
  branch?: unknown;
  headRepository?: string | null;
  base?: string;
  action?: string;
  issue?: Record<string, unknown>;
  readError?: Error;
  writeError?: Error;
  missingPullRequest?: boolean;
}

async function run({
  merged = true,
  branch = "feature/INS-42-synthetic-task",
  headRepository = "owner/repo",
  base = "dev",
  action = "closed",
  issue = { state: "open" },
  readError,
  writeError,
  missingPullRequest = false,
}: Scenario = {}) {
  const get = vi.fn().mockResolvedValue({ data: issue });
  const update = vi.fn().mockResolvedValue({ data: issue });
  if (readError) get.mockRejectedValue(readError);
  if (writeError) update.mockRejectedValue(writeError);
  const setFailed = vi.fn();
  const info = vi.fn();
  await new AsyncFunction("github", "core", "context", source)(
    { rest: { issues: { get, update } } },
    { setFailed, info },
    {
      repo: { owner: "owner", repo: "repo" },
      payload: {
        action,
        pull_request: missingPullRequest
          ? undefined
          : {
              merged,
              head: {
                ref: branch,
                repo:
                  headRepository === null
                    ? null
                    : { full_name: headRepository },
              },
              base: { ref: base },
            },
      },
    },
  );
  return { get, update, setFailed, info };
}

describe("merged INS PR issue policy", () => {
  it.each([
    ["feature", "dev"],
    ["bugfix", "dev"],
    ["feature", "main"],
    ["bugfix", "main"],
  ])("closes a merged %s PR into %s as completed", async (kind, base) => {
    const { get, update, setFailed } = await run({
      branch: `${kind}/INS-42-synthetic-task`,
      base,
    });
    const ticket = { owner: "owner", repo: "repo", issue_number: 42 };
    expect(get).toHaveBeenCalledExactlyOnceWith(ticket);
    expect(update).toHaveBeenCalledExactlyOnceWith({
      ...ticket,
      state: "closed",
      state_reason: "completed",
    });
    expect(setFailed).not.toHaveBeenCalled();
  });

  it.each(["dev", "main"])(
    "leaves the issue untouched when a PR into %s closes without merging",
    async (base) => {
      const result = await run({ merged: false, base });
      expect(result.get).not.toHaveBeenCalled();
      expect(result.update).not.toHaveBeenCalled();
      expect(result.setFailed).not.toHaveBeenCalled();
    },
  );

  it.each([
    { headRepository: "fork/repo" },
    { headRepository: "owner/another-repo" },
    { headRepository: null },
    { base: "release" },
    { action: "opened" },
    { action: "synchronize" },
    { missingPullRequest: true },
  ])("ignores ineligible PR metadata: %j", async (scenario) => {
    const result = await run(scenario);
    expect(result.get).not.toHaveBeenCalled();
    expect(result.update).not.toHaveBeenCalled();
    expect(result.setFailed).not.toHaveBeenCalled();
  });

  it.each([
    "main",
    "feature/no-ticket",
    "feature/INS-42",
    "feature/INS-42-synthetic_task",
    "feature/INS-42-synthetic-task/INS-99-other",
    "feature/INS-42-Synthetic-task",
    "feature/INS--42-synthetic-task",
    "feature/INS-0-synthetic-task",
    "bugfix/INS-000-synthetic-task",
    "bugfix/INS-9007199254740992-synthetic-task",
    null,
    42,
  ])("rejects an invalid or unsafe ticket branch: %s", async (branch) => {
    const result = await run({ branch });
    expect(result.get).not.toHaveBeenCalled();
    expect(result.update).not.toHaveBeenCalled();
    expect(result.setFailed).toHaveBeenCalledOnce();
  });

  it("rejects a branch ticket that points to a PR rather than an issue", async () => {
    const result = await run({ issue: { state: "open", pull_request: {} } });
    expect(result.get).toHaveBeenCalledOnce();
    expect(result.update).not.toHaveBeenCalled();
    expect(result.setFailed).toHaveBeenCalledOnce();
    expect(result.setFailed.mock.calls[0][0]).toMatch(/issue.*pull request/i);
  });

  it.each([
    Object.assign(new Error("Synthetic missing issue"), { status: 404 }),
    Object.assign(new Error("Synthetic API failure"), { status: 503 }),
  ])("fails safely when the issue cannot be read: %s", async (readError) => {
    const result = await run({ readError });
    expect(result.get).toHaveBeenCalledOnce();
    expect(result.update).not.toHaveBeenCalled();
    expect(result.setFailed).toHaveBeenCalledOnce();
  });

  it("reports a rejected issue update without retrying or touching another ticket", async () => {
    const result = await run({
      writeError: new Error("Synthetic write failure"),
    });
    expect(result.get).toHaveBeenCalledOnce();
    expect(result.update).toHaveBeenCalledOnce();
    expect(result.setFailed).toHaveBeenCalledOnce();
  });

  it("is idempotent when GitHub already closed the issue as completed", async () => {
    const result = await run({
      issue: { state: "closed", state_reason: "completed" },
    });
    expect(result.get).toHaveBeenCalledOnce();
    expect(result.update).not.toHaveBeenCalled();
    expect(result.setFailed).not.toHaveBeenCalled();
  });

  it("marks an actually merged task completed even if its issue was previously not planned", async () => {
    const result = await run({
      issue: { state: "closed", state_reason: "not_planned" },
    });
    expect(result.update).toHaveBeenCalledExactlyOnceWith({
      owner: "owner",
      repo: "repo",
      issue_number: 42,
      state: "closed",
      state_reason: "completed",
    });
    expect(result.setFailed).not.toHaveBeenCalled();
  });
});

describe("issue closure workflow security and event configuration", () => {
  it("uses the target-aware pull_request closed event for main and dev", () => {
    expect(workflow).toMatch(/^on:\n {2}pull_request:\n/m);
    expect(workflow).not.toMatch(/pull_request_target:/);
    expect(workflow).toMatch(/branches: \[main, dev\]/);
    expect(workflow).toMatch(/types:\s*(?:\[closed\]|\n\s+- closed)/);
  });

  it("guards writes at job level with merge, same-repository and supported-base checks", () => {
    const guard = workflow.match(/^ {4}if:([^]*?)(?=^ {4}runs-on:)/m)?.[1];
    expect(guard).toBeDefined();
    expect(guard).toMatch(/github\.event\.pull_request\.merged/);
    expect(guard).toMatch(
      /github\.event\.pull_request\.head\.repo\.full_name\s*==\s*github\.repository/,
    );
    expect(guard).toMatch(/github\.event\.pull_request\.base\.ref/);
    expect(guard).toMatch(/['"]main['"]/);
    expect(guard).toMatch(/['"]dev['"]/);
  });

  it("grants only job-scoped issue writes and executes no checked-out PR code", () => {
    expect(workflow).toMatch(/^permissions: \{\}$/m);
    expect(workflow).toMatch(/^ {4}permissions:\n {6}issues: write$/m);
    expect(workflow.match(/issues: write/g)).toHaveLength(1);
    expect(workflow).not.toMatch(
      /pull-requests:|contents:|secrets\.|actions\/checkout|\brun:/,
    );
    expect(workflow.match(/^\s+uses:/gm)).toHaveLength(1);
    expect(workflow).toMatch(/uses: actions\/github-script@v7/);
    expect(source).not.toMatch(/child_process|require\(|import\(|fetch\(/);
    expect(source).not.toMatch(/not_planned/);
  });
});
