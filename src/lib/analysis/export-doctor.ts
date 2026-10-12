import type {
  Account,
  ConnectionKind,
  Dataset,
  Relationship,
} from "../instagram/types";
import { connectionKinds } from "../instagram/connections";
import { analyze } from "./relationships";
import {
  MIN_ORIGIN_STORY_MUTUALS,
  mutualOrigins,
  mutualOriginSummary,
} from "./mutual-origins";

export type ExportDoctorCoreList = {
  records: number;
  sourceFiles?: number;
  jsonFiles?: number;
  htmlFiles?: number;
  datedRecords: number;
  /** Percentage from 0 to 100; undefined for an empty list. */
  dateCoverage?: number;
  exactDates: number;
  timezoneUnknownDates: number;
};
export type ExportDoctorOptionalList = {
  status: "available" | "missing" | "unsupported";
  /** Only available lists have a record count, including an explicit zero. */
  records?: number;
  sourceFiles?: number;
  jsonFiles?: number;
  htmlFiles?: number;
};
export type ExportDoctorWarning = {
  code: string;
  severity: "note" | "warning";
  message: string;
  category?: Relationship;
};
export type ExportDoctorReport = {
  sourceFormat: string;
  contentFormat: "json" | "html" | "mixed" | "unknown";
  provenanceAvailable: boolean;
  sourceTransports?: { json: number; html: number; zip: number };
  core: { followers: ExportDoctorCoreList; following: ExportDoctorCoreList };
  optional: Record<ConnectionKind, ExportDoctorOptionalList>;
  archive: {
    recognizedFiles?: number;
    ignoredFiles?: number;
    splitFollowers?: boolean;
    splitFollowing?: boolean;
    optionalSourceFiles?: number;
    optionalCategoriesFound?: number;
  };
  capabilities: {
    coreRelationships: boolean;
    relationshipDates: boolean;
    mutualOrigins: boolean;
    datedMutuals: number;
    pendingRequests: boolean;
    connectionPrivacy: "full" | "partial" | "unavailable";
    availablePrivacyLists: number;
    unfollowHistory: boolean;
    wrappedDateStories: boolean;
    wrappedFollowingDates: boolean;
    wrappedMutualOrigins: boolean;
    wrappedOriginMinimum: number;
  };
  requestedRange: "unknown";
  generationDate?: string;
  generationDatedFiles?: number;
  generationCheckedFiles?: number;
  generationStatus?: "unverified" | "consistent" | "conflicting";
  warnings: ExportDoctorWarning[];
};

const labels: Record<Relationship, string> = {
  followers: "Followers",
  following: "Following",
  pendingRequests: "Pending requests",
  closeFriends: "Close friends",
  blocked: "Blocked accounts",
  restricted: "Restricted accounts",
  hideStoryFrom: "Story hidden from",
  recentlyUnfollowed: "Your unfollow history",
};
const privacyKinds: ConnectionKind[] = [
  "closeFriends",
  "blocked",
  "restricted",
  "hideStoryFrom",
];

function coverage(
  accounts: readonly Account[],
): Omit<ExportDoctorCoreList, "sourceFiles" | "jsonFiles" | "htmlFiles"> {
  let exactDates = 0,
    timezoneUnknownDates = 0;
  for (const entry of accounts) {
    if (entry.timestamp === undefined) continue;
    if (entry.timestampPrecision === "minute-without-timezone")
      timezoneUnknownDates++;
    else exactDates++;
  }
  const datedRecords = exactDates + timezoneUnknownDates;
  return {
    records: accounts.length,
    datedRecords,
    dateCoverage: accounts.length
      ? (datedRecords / accounts.length) * 100
      : undefined,
    exactDates,
    timezoneUnknownDates,
  };
}

/** Factual active-export diagnostics. No file reads, storage, dates inferred from
 * import time, names, identities, live-state assumptions or arbitrary raw metadata. */
export function exportDoctor(dataset: Dataset): ExportDoctorReport {
  const normalized = analyze(dataset);
  const provenance = dataset.metadata.importProvenance;
  const core = Object.fromEntries(
    (["followers", "following"] as const).map((kind) => {
      const files = provenance?.categories[kind];
      return [
        kind,
        {
          ...coverage(normalized[kind]),
          sourceFiles: files?.sourceFiles,
          jsonFiles: files?.jsonFiles,
          htmlFiles: files?.htmlFiles,
        },
      ];
    }),
  ) as ExportDoctorReport["core"];
  const optional = Object.fromEntries(
    connectionKinds.map((kind) => {
      const list = dataset.connections?.[kind];
      const files = provenance?.categories[kind];
      return [
        kind,
        {
          status: list?.status ?? "missing",
          records:
            list?.status === "available" ? list.accounts.length : undefined,
          sourceFiles: files?.sourceFiles,
          jsonFiles: files?.jsonFiles,
          htmlFiles: files?.htmlFiles,
        },
      ];
    }),
  ) as ExportDoctorReport["optional"];
  const datedMutuals = mutualOriginSummary(mutualOrigins(normalized)).dated;
  const availablePrivacyLists = privacyKinds.filter(
    (kind) => optional[kind].status === "available",
  ).length;
  // Match current Wrapped gates, rather than counting available routes. The
  // following-date story needs one date; the origin story needs ten dated mutuals.
  const wrappedFollowingDates = core.following.datedRecords > 0;
  const wrappedMutualOrigins = datedMutuals >= MIN_ORIGIN_STORY_MUTUALS;
  const warnings: ExportDoctorWarning[] = [];
  for (const kind of ["followers", "following"] as const) {
    const list = core[kind];
    if (list.datedRecords < list.records)
      warnings.push({
        code: "incomplete-date-coverage",
        severity: "note",
        category: kind,
        message: `${labels[kind]} has ${list.records - list.datedRecords} records without usable dates. Missing dates remain unknown.`,
      });
  }
  if (
    core.followers.timezoneUnknownDates + core.following.timezoneUnknownDates >
    0
  )
    warnings.push({
      code: "html-date-precision",
      severity: "note",
      message:
        "HTML dates preserve recorded calendar dates and minutes without a timezone. They are not exact UTC timestamps.",
    });
  for (const kind of connectionKinds)
    if (optional[kind].status === "unsupported")
      warnings.push({
        code: "optional-unsupported",
        severity: "warning",
        category: kind,
        message: `${labels[kind]} was present but could not be read completely. Its results are unavailable; core relationship analysis remains ready.`,
      });
  if (!provenance)
    warnings.push({
      code: "provenance-unavailable",
      severity: "note",
      message:
        "Source-file and archive counts were not recorded for this dataset. They cannot be reconstructed from the final lists.",
    });
  warnings.push({
    code: "requested-range-unknown",
    severity: "note",
    message:
      "Requested export range cannot be verified from these files. Request All time in Instagram for the fullest available relationship data.",
  });
  if (
    provenance?.generationStatus === "consistent" &&
    provenance.generationDate
  )
    warnings.push({
      code: "generation-source-scope",
      severity: "note",
      message: `Generation time is recorded in ${provenance.generationDatedFiles} successfully parsed HTML relationship files. This is not a verified generation date for the whole ZIP or mixed selection.`,
    });
  else
    warnings.push({
      code: "generation-date-unknown",
      severity: "note",
      message:
        provenance?.generationStatus === "conflicting"
          ? "HTML files record different generation times. A single generation time cannot be verified for this selection."
          : "A trustworthy archive-generation date is not verified by this import. Import time and relationship dates are not the export-generation date.",
    });
  const formats = provenance?.contentFormats;
  return {
    sourceFormat: dataset.metadata.sourceFormat,
    contentFormat: formats
      ? formats.json > 0 && formats.html > 0
        ? "mixed"
        : formats.json > 0
          ? "json"
          : formats.html > 0
            ? "html"
            : "unknown"
      : "unknown",
    provenanceAvailable: provenance !== undefined,
    sourceTransports: provenance ? { ...provenance.transports } : undefined,
    core,
    optional,
    archive: {
      recognizedFiles: provenance?.recognizedFiles,
      ignoredFiles: provenance?.ignoredFiles,
      splitFollowers: provenance
        ? provenance.categories.followers.sourceFiles > 1
        : undefined,
      splitFollowing: provenance
        ? provenance.categories.following.sourceFiles > 1
        : undefined,
      optionalSourceFiles: provenance
        ? connectionKinds.reduce(
            (total, kind) => total + provenance.categories[kind].sourceFiles,
            0,
          )
        : undefined,
      optionalCategoriesFound: provenance
        ? connectionKinds.filter(
            (kind) => provenance.categories[kind].sourceFiles > 0,
          ).length
        : undefined,
    },
    capabilities: {
      coreRelationships: true,
      relationshipDates:
        core.followers.datedRecords + core.following.datedRecords > 0,
      mutualOrigins: datedMutuals > 0,
      datedMutuals,
      pendingRequests: optional.pendingRequests.status === "available",
      connectionPrivacy:
        availablePrivacyLists === privacyKinds.length
          ? "full"
          : availablePrivacyLists > 0
            ? "partial"
            : "unavailable",
      availablePrivacyLists,
      unfollowHistory: optional.recentlyUnfollowed.status === "available",
      wrappedDateStories: wrappedFollowingDates || wrappedMutualOrigins,
      wrappedFollowingDates,
      wrappedMutualOrigins,
      wrappedOriginMinimum: MIN_ORIGIN_STORY_MUTUALS,
    },
    requestedRange: "unknown",
    generationDate:
      provenance?.generationStatus === "consistent"
        ? provenance.generationDate
        : undefined,
    generationDatedFiles: provenance?.generationDatedFiles,
    generationCheckedFiles: provenance?.generationCheckedFiles,
    generationStatus: provenance?.generationStatus,
    warnings,
  };
}
