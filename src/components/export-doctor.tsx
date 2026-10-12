"use client";
import { useId, useRef } from "react";
import { track } from "@/lib/analytics";
import type { ExportDoctorReport } from "@/lib/analysis/export-doctor";
import { connectionKinds } from "@/lib/instagram/connections";
import type { ConnectionKind } from "@/lib/instagram/types";
import "./export-doctor.css";

const number = (value: number) => value.toLocaleString("en-US");
const percentage = (value: number) =>
  `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
const labels: Record<ConnectionKind, string> = {
  pendingRequests: "Pending requests",
  recentFollowRequests: "Recent sent-request records",
  removedSuggestions: "Removed suggestions",
  closeFriends: "Close friends",
  blocked: "Blocked accounts",
  restricted: "Restricted accounts",
  hideStoryFrom: "Story hidden from",
  recentlyUnfollowed: "Your unfollow history",
};
const coreLists = ["followers", "following"] as const;
const coreLabels = { followers: "Followers", following: "Following" };
const formats: Record<string, string> = {
  json: "JSON",
  html: "HTML",
  zip: "ZIP",
  mixed: "Mixed JSON / HTML",
  demo: "Fictional demo",
};
function source(report: ExportDoctorReport) {
  const inputs = report.sourceTransports;
  let transport = formats[report.sourceFormat] ?? "Not recorded";
  if (inputs) {
    const loose = inputs.json + inputs.html;
    transport =
      inputs.zip > 0
        ? loose > 0
          ? "ZIP + loose files"
          : "ZIP"
        : inputs.json > 0 && inputs.html > 0
          ? "Loose files"
          : inputs.json > 0
            ? "JSON"
            : inputs.html > 0
              ? "HTML"
              : "Not recorded";
    if (report.sourceFormat === "demo")
      transport = `Fictional demo · ${transport}`;
  }
  return report.contentFormat !== "unknown" &&
    formats[report.contentFormat] !== transport
    ? `${transport} · ${formats[report.contentFormat]} relationship files`
    : transport;
}
function optionalStatus(entry: ExportDoctorReport["optional"][ConnectionKind]) {
  if (entry.status === "missing") return "Not included";
  if (entry.status === "unsupported") return "Included · Could not read";
  return entry.records === undefined
    ? "Included"
    : `Included · ${number(entry.records)} record${entry.records === 1 ? "" : "s"}`;
}
function files(count?: number) {
  return count === undefined
    ? "Source file count not recorded"
    : `${number(count)} source file${count === 1 ? "" : "s"}`;
}

export function ExportDoctor({
  report,
  demo = false,
  demoExampleReport,
}: {
  report: ExportDoctorReport;
  demo?: boolean;
  demoExampleReport?: ExportDoctorReport;
}) {
  const id = useId();
  const opened = useRef(false);
  const lists = Object.values(report.optional);
  const readable = lists.filter((entry) => entry.status === "available").length;
  const missing = lists.filter((entry) => entry.status === "missing").length;
  const unsupported = lists.filter(
    (entry) => entry.status === "unsupported",
  ).length;
  const followers = report.core.followers;
  return (
    <section
      id="export-doctor"
      className="export-doctor"
      aria-label="Export status"
    >
      <div className="export-doctor-heading">
        <h2>Export status</h2>
        <p>Checked locally from this export.</p>
      </div>
      {demo && (
        <p className="export-doctor-demo">
          Demo diagnostics · Fictional example
        </p>
      )}
      <ul className="export-doctor-summary">
        <li>
          {report.capabilities.coreRelationships
            ? "Core relationships ready"
            : "Core relationships unavailable"}
        </li>
        <li>
          {followers.dateCoverage === undefined
            ? "No follower records in this export"
            : `${percentage(followers.dateCoverage)} follower dates recorded`}
        </li>
        <li>
          {readable} of {lists.length} optional lists readable
        </li>
      </ul>
      {(missing > 0 || unsupported > 0) && (
        <p className="export-doctor-limited">
          {missing > 0 &&
            `${missing} optional ${missing === 1 ? "list" : "lists"} not included. `}
          {unsupported > 0 && `${unsupported} included but could not be read. `}
          {report.capabilities.coreRelationships &&
            "Core tools remain available."}
        </p>
      )}
      <details
        className="export-doctor-details"
        onToggle={(event) => {
          if (
            event.target !== event.currentTarget ||
            !event.currentTarget.open ||
            opened.current
          )
            return;
          opened.current = true;
          track("export_doctor_opened");
        }}
      >
        <summary>View export details</summary>
        <section
          className="export-doctor-expanded"
          aria-labelledby={`${id}-details`}
        >
          <h3 id={`${id}-details`}>Export Doctor</h3>
          <DoctorDetails report={report} />
          {demo && demoExampleReport && (
            <details className="export-doctor-example">
              <summary>See a fictional partial export</summary>
              <section aria-labelledby={`${id}-example`}>
                <h4 id={`${id}-example`}>Fictional partial export</h4>
                <p>
                  A separate fictional illustration of missing, unreadable and
                  included-empty categories. It is not the active demo export
                  and does not change its tools.
                </p>
                <DoctorDetails report={demoExampleReport} headingLevel={5} />
              </section>
            </details>
          )}
        </section>
      </details>
    </section>
  );
}

function DoctorDetails({
  report,
  headingLevel = 4,
}: {
  report: ExportDoctorReport;
  headingLevel?: 4 | 5;
}) {
  const Heading = headingLevel === 4 ? "h4" : "h5";
  const capability = report.capabilities;
  return (
    <div className="export-doctor-sections">
      <section>
        <Heading>Core lists</Heading>
        <dl className="export-doctor-rows">
          {coreLists.map((kind) => (
            <div data-doctor-core={kind} key={kind}>
              <dt>{coreLabels[kind]}</dt>
              <dd>
                Included · {number(report.core[kind].records)} record
                {report.core[kind].records === 1 ? "" : "s"}
                <small>{files(report.core[kind].sourceFiles)}</small>
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <section>
        <Heading>Date coverage</Heading>
        <dl className="export-doctor-rows">
          {coreLists.map((kind) => {
            const list = report.core[kind];
            return (
              <div data-doctor-dates={kind} key={kind}>
                <dt>{coreLabels[kind]}</dt>
                <dd>
                  {number(list.datedRecords)} of {number(list.records)} with
                  usable recorded dates
                  {list.dateCoverage !== undefined &&
                    ` · ${percentage(list.dateCoverage)}`}
                  <small>
                    {number(list.exactDates)} exact timestamps ·{" "}
                    {number(list.timezoneUnknownDates)} HTML minute
                    {list.timezoneUnknownDates === 1 ? "" : "s"} without
                    timezone
                  </small>
                </dd>
              </div>
            );
          })}
        </dl>
        <p className="export-doctor-help">
          JSON timestamps identify an instant. HTML dates preserve the displayed
          calendar date and minute; their timezone is unknown. Missing dates
          stay unavailable.
        </p>
      </section>
      <section>
        <Heading>Optional lists</Heading>
        <dl className="export-doctor-rows">
          {connectionKinds.map((kind) => (
            <div data-doctor-category={kind} key={kind}>
              <dt>{labels[kind]}</dt>
              <dd>
                <span
                  className="export-doctor-list-status"
                  data-status={report.optional[kind].status}
                >
                  {optionalStatus(report.optional[kind])}
                </span>
                <small>{files(report.optional[kind].sourceFiles)}</small>
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <section>
        <Heading>Archive structure</Heading>
        <dl className="export-doctor-rows">
          <div>
            <dt>Source</dt>
            <dd>{source(report)}</dd>
          </div>
          {coreLists.map((kind) => (
            <div key={kind}>
              <dt>{coreLabels[kind]} files</dt>
              <dd>
                {report.core[kind].sourceFiles === undefined
                  ? "Not recorded"
                  : `${number(report.core[kind].sourceFiles!)} ${kind === "followers" ? "follower" : "following"} file${report.core[kind].sourceFiles === 1 ? "" : "s"}${report.archive[kind === "followers" ? "splitFollowers" : "splitFollowing"] ? " combined" : ""}`}
              </dd>
            </div>
          ))}
          <div>
            <dt>Recognized files</dt>
            <dd>
              {report.archive.recognizedFiles === undefined
                ? "Not recorded"
                : number(report.archive.recognizedFiles)}
            </dd>
          </div>
          <div>
            <dt>Ignored files</dt>
            <dd>
              {report.archive.ignoredFiles === undefined
                ? "Not recorded"
                : number(report.archive.ignoredFiles)}
            </dd>
          </div>
          <div>
            <dt>Optional categories found</dt>
            <dd>
              {report.archive.optionalCategoriesFound === undefined
                ? "Not recorded"
                : number(report.archive.optionalCategoriesFound)}
            </dd>
          </div>
          <div>
            <dt>Optional source files</dt>
            <dd>
              {report.archive.optionalSourceFiles === undefined
                ? "Not recorded"
                : number(report.archive.optionalSourceFiles)}
            </dd>
          </div>
        </dl>
        {!report.provenanceAvailable && (
          <p className="export-doctor-help">
            Source file counts were not recorded for this dataset. They are not
            inferred from the final lists.
          </p>
        )}
      </section>
      <section className="export-doctor-availability">
        <Heading>Analysis availability</Heading>
        <dl className="export-doctor-rows">
          <div data-doctor-capability="coreRelationships">
            <dt>Core Circle</dt>
            <dd>{capability.coreRelationships ? "Ready" : "Unavailable"}</dd>
          </div>
          <div data-doctor-capability="relationshipDates">
            <dt>Relationship Timeline</dt>
            <dd>
              {capability.relationshipDates
                ? "Recorded-date insights available where dates were supplied"
                : "Unavailable · No usable recorded dates"}
            </dd>
          </div>
          <div data-doctor-capability="mutualOrigins">
            <dt>Mutual Origins</dt>
            <dd>
              {capability.mutualOrigins
                ? `Available for ${number(capability.datedMutuals)} dated mutuals`
                : "Unavailable · No mutuals with two comparable recorded dates"}
            </dd>
          </div>
          <div data-doctor-capability="pendingRequests">
            <dt>Pending Requests</dt>
            <dd>{optionalStatus(report.optional.pendingRequests)}</dd>
          </div>
          <div data-doctor-capability="recentSentRequests">
            <dt>Recent sent-request records</dt>
            <dd>{optionalStatus(report.optional.recentFollowRequests)}</dd>
          </div>
          <div data-doctor-capability="removedSuggestions">
            <dt>Removed suggestions</dt>
            <dd>{optionalStatus(report.optional.removedSuggestions)}</dd>
          </div>
          <div data-doctor-capability="connectionPrivacy">
            <dt>Connection Privacy</dt>
            <dd>
              {capability.connectionPrivacy === "full"
                ? "Full"
                : capability.connectionPrivacy === "partial"
                  ? "Partial"
                  : "Unavailable"}{" "}
              · {capability.availablePrivacyLists} of 4 lists readable
            </dd>
          </div>
          <div data-doctor-capability="unfollowHistory">
            <dt>Your Unfollow History</dt>
            <dd>{optionalStatus(report.optional.recentlyUnfollowed)}</dd>
          </div>
          <div data-doctor-capability="wrappedDateStories">
            <dt>Wrapped date stories</dt>
            <dd>
              {capability.wrappedDateStories
                ? "Some recorded-date stories available"
                : "Limited · Recorded-date stories unavailable"}
              <small>
                Following-date stories:{" "}
                {capability.wrappedFollowingDates ? "available" : "unavailable"}
                . Mutual-origin stories:{" "}
                {capability.wrappedMutualOrigins
                  ? "available"
                  : `need at least ${capability.wrappedOriginMinimum} dated mutuals`}
                .
              </small>
            </dd>
          </div>
        </dl>
      </section>
      <section className="export-doctor-limitations">
        <Heading>Limitations</Heading>
        <ul>
          {report.generationDate && (
            <li>
              Generation time recorded in{" "}
              {report.generationDatedFiles === undefined
                ? "recognized HTML files"
                : `${number(report.generationDatedFiles)} HTML file${report.generationDatedFiles === 1 ? "" : "s"}`}
              :{" "}
              <time dateTime={report.generationDate}>
                {new Date(report.generationDate).toLocaleString("en-GB", {
                  year: "numeric",
                  month: "short",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                  timeZone: "UTC",
                })}{" "}
                UTC
              </time>
              .{" "}
              {report.generationCheckedFiles !== undefined &&
                `${number(report.generationCheckedFiles)} recognized HTML files checked. `}
              This time applies only to those HTML files; it does not date other
              files in a mixed selection or establish a generation time for the
              whole ZIP.
            </li>
          )}
          {report.warnings
            .filter(
              (warning) =>
                warning.code !== "generation-source-scope" ||
                !report.generationDate,
            )
            .map((warning) => (
              <li key={`${warning.code}:${warning.category ?? "export"}`}>
                {warning.message}
              </li>
            ))}
          <li>
            File modified time and a user-entered Snapshot Vault date do not
            establish when Instagram generated an export.
          </li>
          <li>
            Recorded dates and list membership do not reconstruct removed
            relationships, historical follower totals or uninterrupted
            following. A sent request record does not prove it is still pending
            today.
          </li>
          <li>
            Recent sent-request records are separate from pending requests; the
            export does not identify which were confirmed or deleted. Removed
            suggestions are not removed followers. Dates in these lists are
            recorded values, not verified action times.
          </li>
        </ul>
      </section>
    </div>
  );
}
