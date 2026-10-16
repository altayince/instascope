import { expect, it } from "vitest";
import {
  isHostedProductionBuild,
  isWorkersPreviewBuild,
} from "../../scripts/build.mjs";

const featureBranch = "feature/INS-142-whatsappscope-release-hardening";

it.each([
  ["dev", "dev"],
  [featureBranch, featureBranch],
  [featureBranch, undefined],
  [featureBranch, ""],
])(
  "uses the preview build for an explicit Workers branch %s (local %s)",
  (hostBranch, localBranch) => {
    expect(
      isWorkersPreviewBuild(
        { WORKERS_CI: "1", WORKERS_CI_BRANCH: hostBranch },
        localBranch,
      ),
    ).toBe(true);
  },
);

it("chooses the preview path despite inherited production public settings", () => {
  expect(
    isWorkersPreviewBuild(
      {
        WORKERS_CI: "1",
        WORKERS_CI_BRANCH: featureBranch,
        NEXT_PUBLIC_SITE_URL: "https://instascope.me",
        NEXT_PUBLIC_PREVIEW: "false",
        NEXT_PUBLIC_WHATSAPP_ENABLED: "false",
      },
      featureBranch,
    ),
  ).toBe(true);
});

it.each([
  { WORKERS_CI: "1", WORKERS_CI_BRANCH: "main" },
  { CF_PAGES: "1", CF_PAGES_BRANCH: "main" },
])(
  "normalizes an identified main build despite inherited preview flags (%j)",
  (host) => {
    const environment = {
      ...host,
      NEXT_PUBLIC_PREVIEW: "true",
      NEXT_PUBLIC_WHATSAPP_ENABLED: "true",
    };
    expect(isHostedProductionBuild(environment)).toBe(true);
    expect(isWorkersPreviewBuild(environment, "main")).toBe(false);
  },
);

it.each([
  {},
  { WORKERS_CI: "1" },
  { WORKERS_CI: "1", WORKERS_CI_BRANCH: "" },
  { WORKERS_CI: "1", WORKERS_CI_BRANCH: "HEAD" },
  { WORKERS_CI: "1", WORKERS_CI_BRANCH: "main " },
  { WORKERS_CI_BRANCH: "main" },
  { WORKERS_CI: "1", WORKERS_CI_BRANCH: "dev" },
  { CF_PAGES: "1" },
  { CF_PAGES: "1", CF_PAGES_BRANCH: "dev" },
  {
    WORKERS_CI: "1",
    WORKERS_CI_BRANCH: "main",
    CF_PAGES: "1",
    CF_PAGES_BRANCH: "dev",
  },
])(
  "does not promote unknown or conflicting host contexts to production (%j)",
  (environment) => {
    expect(isHostedProductionBuild(environment)).toBe(false);
  },
);

it.each([
  ["missing Workers marker", undefined],
  ["a truthy but unsupported Workers marker", "true"],
  ["a disabled Workers marker", "0"],
])("keeps the default build with %s", (_label, marker) => {
  expect(
    isWorkersPreviewBuild(
      { WORKERS_CI: marker, WORKERS_CI_BRANCH: featureBranch },
      featureBranch,
    ),
  ).toBe(false);
});

it.each([undefined, "", "   ", "HEAD"])(
  "does not substitute local Git for missing or unknown Workers branch %s",
  (hostBranch) => {
    expect(
      isWorkersPreviewBuild(
        { WORKERS_CI: "1", WORKERS_CI_BRANCH: hostBranch },
        featureBranch,
      ),
    ).toBe(false);
  },
);

it.each([
  ["local main", "main", {}],
  ["local main ref", "refs/heads/main", {}],
  ["Workers main", featureBranch, { WORKERS_CI_BRANCH: "main" }],
  ["Workers main ref", featureBranch, { WORKERS_CI_BRANCH: "refs/heads/main" }],
  ["Pages main", featureBranch, { CF_PAGES_BRANCH: "main" }],
  ["Pages main ref", featureBranch, { CF_PAGES_BRANCH: "refs/heads/main" }],
  ["PR targeting main", featureBranch, { GITHUB_BASE_REF: "main" }],
  [
    "PR targeting main ref",
    featureBranch,
    { GITHUB_BASE_REF: "refs/heads/main" },
  ],
  ["GitHub main", featureBranch, { GITHUB_REF_NAME: "main" }],
  ["GitHub main ref", featureBranch, { GITHUB_REF_NAME: "refs/heads/main" }],
])(
  "keeps the default build for %s despite inherited preview flags",
  (_label, localBranch, branchEnvironment) => {
    expect(
      isWorkersPreviewBuild(
        {
          WORKERS_CI: "1",
          WORKERS_CI_BRANCH: featureBranch,
          NEXT_PUBLIC_PREVIEW: "true",
          NEXT_PUBLIC_WHATSAPP_ENABLED: "true",
          ...branchEnvironment,
        },
        localBranch,
      ),
    ).toBe(false);
  },
);

it.each([
  ["ordinary local build", {}],
  ["GitHub dev PR build", { GITHUB_ACTIONS: "true", GITHUB_BASE_REF: "dev" }],
  ["Pages non-main build", { CF_PAGES: "1", CF_PAGES_BRANCH: "dev" }],
])("does not auto-enable WhatsApp for an %s", (_label, environment) => {
  expect(isWorkersPreviewBuild(environment, featureBranch)).toBe(false);
});
