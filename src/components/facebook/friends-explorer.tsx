"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { readFacebook } from "@/lib/facebook/browser";
import { exploreConnections } from "@/lib/facebook/analysis";
import {
  categoryLabels,
  connectionCategories,
  type ConnectionCategory,
  type FacebookDataset,
} from "@/lib/facebook/types";
import { useBrowserReady } from "../use-browser-ready";
import "./friends-explorer.css";

const coverageLabels = {
  absent: "Not included",
  empty: "Included · empty",
  supported: "Supported",
  partial: "Partial",
  unsupported: "Unsupported structure",
};
const PAGE_SIZE = 100;
export function FriendsExplorer() {
  const ready = useBrowserReady();
  const [dataset, setDataset] = useState<FacebookDataset>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [category, setCategory] = useState<ConnectionCategory>("friends");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "name">("newest");
  const [timeZone, setTimeZone] = useState("UTC");
  const [page, setPage] = useState(0);
  const [grouped, setGrouped] = useState(true);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function load(file?: File) {
    if (!file) return;
    controller.current?.abort();
    const operation = new AbortController();
    controller.current = operation;
    setBusy(true);
    setError("");
    setDataset(undefined);
    try {
      const result = await readFacebook(file, operation.signal);
      if (!operation.signal.aborted) {
        setDataset(result);
        setCategory("friends");
        setQuery("");
        setPage(0);
      }
    } catch (failure) {
      if (controller.current === operation)
        setError(
          failure instanceof Error
            ? failure.message
            : "Unable to import this ZIP. Try a fresh Facebook export.",
        );
    } finally {
      if (controller.current === operation) setBusy(false);
    }
  }
  const coverage = dataset?.categories[category];
  const rows = useMemo(
    () => exploreConnections(coverage?.records ?? [], query, sort, timeZone),
    [coverage, query, sort, timeZone],
  );
  const shown = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const groups = new Map<string, typeof shown>();
  for (const row of shown) {
    const year = grouped
      ? (row.displayDate?.slice(0, 4) ?? "Date unavailable")
      : "Records";
    const list = groups.get(year) ?? [];
    list.push(row);
    groups.set(year, list);
  }
  return (
    <main id="main" className="fb-workspace">
      <section className="fb-hero">
        <span className="eyebrow">
          InstaScope / Facebook · Development preview
        </span>
        <h1>Friends Explorer</h1>
        <p>
          A little perspective on your connections. Explore the names and
          friendship dates recorded in your Facebook export.
        </p>
        <p>
          Your ZIP is processed in this browser. No login, uploads or automatic
          saving.
        </p>
      </section>
      <section className="fb-panel" aria-labelledby="fb-import-title">
        <h2 id="fb-import-title">Open your Facebook export</h2>
        <p>
          Choose one official JSON or HTML ZIP containing Connections → Friends.
          These are alternative formats of an export, not two historical
          snapshots.
        </p>
        <label className="fb-file-label">
          Facebook JSON or HTML ZIP
          <input
            type="file"
            accept=".zip,application/zip"
            disabled={!ready || busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void load(file);
            }}
          />
        </label>
        {busy && (
          <div role="status">
            Reading supported connection files locally…{" "}
            <button type="button" onClick={() => controller.current?.abort()}>
              Cancel import
            </button>
          </div>
        )}
        {error && <p role="alert">{error}</p>}
        <details>
          <summary>Export help and limits</summary>
          <p>
            In Facebook Accounts Center, download your information and select
            Connections / Friends. Choose JSON or HTML. Import one unencrypted
            ZIP up to 2 GB, with at most 10,000 files and 20 MB per supported
            connection file (60 MB expanded). ZIP64 and split archives are
            unsupported. Media, messages, login and payment files are ignored.
          </p>
        </details>
      </section>
      {dataset && (
        <>
          <section className="fb-panel" aria-labelledby="fb-coverage-title">
            <div className="fb-heading">
              <h2 id="fb-coverage-title">Import coverage</h2>
              <button
                type="button"
                onClick={() => {
                  setDataset(undefined);
                  setQuery("");
                }}
              >
                Clear imported data
              </button>
            </div>
            <p>
              {dataset.format.toUpperCase()} format · Only four connection
              categories are supported. {dataset.ignoredFiles} unrelated files
              skipped.
            </p>
            <div className="fb-coverage-grid">
              {connectionCategories.map((key) => {
                const item = dataset.categories[key];
                return (
                  <div className="fb-coverage" key={key}>
                    <h3>{categoryLabels[key]}</h3>
                    <strong>{item.records.length} records</strong>
                    <p>{coverageLabels[item.state]}</p>
                    <small>
                      {item.sourceRows} source rows · {item.invalidRows}{" "}
                      unreadable rows · {item.unknownDates} unknown dates ·{" "}
                      {item.repairedNames} names recovered
                    </small>
                  </div>
                );
              })}
            </div>
            <p>
              Names are display labels, not unique identities. Duplicate names
              remain separate source rows. Local row numbers cannot identify
              people across exports.
            </p>
            <p>
              {dataset.format === "html"
                ? "HTML dates are shown exactly as recorded. This format omits the timezone; no UTC instant is inferred. English and Turkish date forms are supported; unrecognized dates stay unavailable."
                : "JSON dates are epoch seconds. Choose a display timezone below; source instants are preserved."}
            </p>
          </section>
          <section className="fb-panel" aria-labelledby="fb-results-title">
            <h2 id="fb-results-title">Explore connection records</h2>
            <div className="fb-controls">
              <label>
                Category
                <select
                  value={category}
                  onChange={(event) => {
                    setCategory(event.target.value as ConnectionCategory);
                    setPage(0);
                  }}
                >
                  {connectionCategories.map((key) => (
                    <option value={key} key={key}>
                      {categoryLabels[key]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Search names
                <input
                  type="search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(0);
                  }}
                />
              </label>
              <label>
                Sort records
                <select
                  value={sort}
                  onChange={(event) => {
                    setSort(event.target.value as typeof sort);
                    setPage(0);
                  }}
                >
                  <option value="newest">Newest recorded date</option>
                  <option value="oldest">Oldest recorded date</option>
                  <option value="name">Name</option>
                </select>
              </label>
              {dataset.format === "json" && (
                <label>
                  Date display timezone
                  <select
                    value={timeZone}
                    onChange={(event) => {
                      setTimeZone(event.target.value);
                      setPage(0);
                    }}
                  >
                    {[
                      "UTC",
                      "Europe/Berlin",
                      "Europe/Istanbul",
                      "America/New_York",
                      "Asia/Tokyo",
                    ].map((zone) => (
                      <option key={zone}>{zone}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <label className="fb-group">
              <input
                type="checkbox"
                checked={grouped}
                onChange={(event) => setGrouped(event.target.checked)}
              />
              Group visible records by recorded year
            </label>
            <p className="fb-source-note">
              {category === "friends"
                ? "Current friend records as included in this export. Recorded dates do not reconstruct a complete friendship history."
                : category === "removed"
                  ? "Removal records do not establish who removed whom or why."
                  : "Requests are recorded export entries, not a check of their status today."}
            </p>
            {coverage?.state === "absent" ? (
              <p role="status">This category was not included in the export.</p>
            ) : coverage?.state === "unsupported" ? (
              <p role="status">
                This category has an unsupported or malformed structure. No
                empty-list claim can be made. Request a fresh export.
              </p>
            ) : coverage?.state === "empty" ? (
              <p role="status">
                The included category explicitly contains no records.
              </p>
            ) : !rows.length ? (
              <p role="status">
                {query
                  ? "No records match your search."
                  : "No readable records. Check the import diagnostics."}
              </p>
            ) : (
              <>
                <p role="status">
                  {rows.length} matching records · Showing{" "}
                  {page * PAGE_SIZE + 1}–
                  {Math.min((page + 1) * PAGE_SIZE, rows.length)}
                </p>
                {[...groups].map(([year, list]) => (
                  <section className="fb-year" key={year}>
                    <h3>{year}</h3>
                    <ul>
                      {list.map((row) => (
                        <li key={row.row}>
                          <div>
                            <strong>{row.name}</strong>
                            <small>
                              Source row {row.row + 1}
                              {row.markedAsSpam === undefined
                                ? ""
                                : row.markedAsSpam
                                  ? " · Marked as spam in export"
                                  : " · Not marked as spam in export"}
                            </small>
                          </div>
                          <span>
                            {row.displayDate ? (
                              <time dateTime={row.displayDate}>
                                {row.displayDate.replace("T", " · ")}
                              </time>
                            ) : (
                              "Date unavailable"
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
                <nav
                  className="fb-pagination"
                  aria-label="Connection records pages"
                >
                  <button
                    type="button"
                    disabled={page === 0}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {page + 1} of {Math.ceil(rows.length / PAGE_SIZE)}
                  </span>
                  <button
                    type="button"
                    disabled={(page + 1) * PAGE_SIZE >= rows.length}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </button>
                </nav>
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}
