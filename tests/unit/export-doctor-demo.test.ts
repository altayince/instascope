import { expect, it } from "vitest";
import { demoPartialExport, demoSnapshots } from "../../src/lib/demo";
import { exportDoctor } from "../../src/lib/analysis/export-doctor";
import { createVaultSnapshot } from "../../src/lib/snapshot-vault";

it("demonstrates fictional split JSON coverage without changing the complete tool demo", () => {
  const dataset = demoSnapshots().newer;
  const report = exportDoctor(dataset);
  expect(dataset.metadata.demo).toBe(true);
  expect(report.contentFormat).toBe("json");
  expect(report.sourceTransports?.zip).toBe(1);
  expect(report.archive.splitFollowers).toBe(true);
  expect(report.core.followers).toMatchObject({
    records: 1284,
    datedRecords: 1244,
    sourceFiles: 3,
  });
  expect(report.core.following).toMatchObject({
    records: 932,
    datedRecords: 903,
    sourceFiles: 1,
  });
  expect(report.core.followers.dateCoverage).toBeLessThan(100);
  expect(report.capabilities.connectionPrivacy).toBe("full");
  expect(Object.values(report.optional)).toHaveLength(8);
  expect(
    Object.values(report.optional).every((list) => list.status === "available"),
  ).toBe(true);
  expect(report.optional.recentFollowRequests).toMatchObject({
    status: "available",
    records: 3,
    sourceFiles: 1,
  });
  expect(report.optional.removedSuggestions).toMatchObject({
    status: "available",
    records: 4,
    sourceFiles: 1,
  });
  expect(report.capabilities.recentSentRequests).toBe(true);
  expect(report.capabilities.removedSuggestions).toBe(true);
  expect(report.archive.optionalCategoriesFound).toBe(8);
  expect(JSON.stringify(report)).not.toContain("demo.mutual.");
  expect(JSON.stringify(report)).not.toContain("demo.recentrequest.");
  expect(JSON.stringify(report)).not.toContain("demo.suggestion.");
});

it("keeps a partial fictional Doctor example separate from active demo tools", () => {
  const partial = demoPartialExport();
  const report = exportDoctor(partial);
  expect(partial.metadata.demo).toBe(true);
  expect(report.optional.pendingRequests.status).toBe("missing");
  expect(report.optional.pendingRequests.records).toBeUndefined();
  expect(report.optional.blocked).toMatchObject({
    status: "available",
    records: 0,
  });
  expect(report.optional.restricted.status).toBe("unsupported");
  expect(report.optional.restricted.records).toBeUndefined();
  expect(report.optional.hideStoryFrom.status).toBe("missing");
  expect(report.optional.recentFollowRequests.status).toBe("missing");
  expect(report.optional.recentFollowRequests.records).toBeUndefined();
  expect(report.optional.removedSuggestions).toMatchObject({
    status: "available",
    records: 0,
  });
  expect(report.capabilities.recentSentRequests).toBe(false);
  expect(report.capabilities.removedSuggestions).toBe(true);
  expect(
    Object.values(report.optional).filter((list) => list.status === "missing"),
  ).toHaveLength(3);
  expect(
    Object.values(report.optional).filter(
      (list) => list.status === "unsupported",
    ),
  ).toHaveLength(1);
  expect(report.capabilities.connectionPrivacy).toBe("partial");
  expect(report.capabilities.availablePrivacyLists).toBe(2);
  const complete = demoSnapshots().newer;
  expect(complete.connections!.blocked.accounts).toHaveLength(4);
  expect(complete.connections!.restricted.accounts).toHaveLength(3);
  expect(complete.connections!.hideStoryFrom.accounts).toHaveLength(5);
  expect(complete.connections!.pendingRequests.accounts).toHaveLength(3);
  expect(complete.connections!.recentFollowRequests.accounts).toHaveLength(3);
  expect(complete.connections!.removedSuggestions.accounts).toHaveLength(4);
});

it("does not carry diagnostic provenance into Vault snapshots", () => {
  const dataset = demoSnapshots().newer;
  // Synthetic real-data flag to exercise the ordinary Vault serializer.
  dataset.metadata.demo = false;
  const saved = createVaultSnapshot(
    dataset,
    "2025-01-15",
    "synthetic-doctor",
    1,
  );
  expect(Object.keys(saved).sort()).toEqual([
    "createdAt",
    "exportDate",
    "followers",
    "following",
    "id",
    "version",
  ]);
  expect(JSON.stringify(saved)).not.toContain("importProvenance");
  expect(JSON.stringify(saved)).not.toContain("recognizedFiles");
});
