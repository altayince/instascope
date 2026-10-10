"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Account, Dataset } from "@/lib/instagram/types";
import {
  normalizeUsername,
  isDeletedInstagramAccount,
} from "@/lib/instagram/normalize";
import {
  timelineAccountIndex,
  timelineAccountSummary,
  timelineAccountContext,
} from "@/lib/analysis/timeline-context";
import {
  mutualOriginLabels,
  MUTUAL_ORIGIN_CAVEAT,
} from "@/lib/analysis/mutual-origins";
import {
  relationshipStateLabels,
  type RelationshipHistoryIndex,
} from "@/lib/analysis/relationship-history";
import { demoVaultSnapshots } from "@/lib/demo";
import { formatSnapshotDate } from "@/lib/snapshot-vault";
import { validExportDate } from "@/lib/snapshot-storage";
import { vaultStorageMessage } from "@/lib/vault-storage";
import { useData } from "./data-provider";
import { useVaultHistoryIndex } from "./use-vault-history";
import { AccountHistoryDetails } from "./account-history-details";

const examples = [
  ["demo.mutual.0100", "Stable mutual"],
  ["demo.oneway.0001", "Mutual → You follow → Absent"],
  ["demo.fan.0001", "Follows you → Mutual"],
  ["demo.mutual.0002", "They followed first"],
  ["demo.mutual.0001", "You followed first"],
  ["demo.mutual.0003", "Same recorded day"],
  ["demo.mutual.0032", "Unknown dates"],
  ["demo.request.0001", "Sent request record"],
];
const display = (name: string) =>
  isDeletedInstagramAccount(name) ? "Deleted account" : `@${name}`;
const date = (account?: Account) =>
  account?.timestamp === undefined
    ? "Date unavailable"
    : new Date(account.timestamp * 1000).toLocaleDateString("en-US", {
        dateStyle: "medium",
        timeZone: "UTC",
      });
type View = "Summary" | "Saved History" | "Context";
export const RELATIONSHIP_INSPECTION_EVENT = "instascope:inspect-relationship";

export function TimelineAccount({
  dataset,
  username,
  initialUsername = "",
  presentation = "timeline",
}: {
  dataset: Dataset;
  username?: string;
  initialUsername?: string;
  presentation?: "timeline" | "drawer";
}) {
  const drawer = presentation === "drawer";
  const ContextHeading = drawer ? "h3" : "h5";
  const preset = username ?? initialUsername;
  const { vault, currentExportDate } = useData();
  const fictional = useMemo(
    () => (dataset.metadata.demo ? demoVaultSnapshots() : undefined),
    [dataset],
  );
  const { signature, load } = useVaultHistoryIndex(fictional);
  const index = useMemo(() => timelineAccountIndex(dataset), [dataset]);
  const coverage = useMemo(
    () => ({
      followers: [...index.followers.values()].filter(
        (a) => a.timestamp !== undefined,
      ).length,
      following: [...index.following.values()].filter(
        (a) => a.timestamp !== undefined,
      ).length,
      mutuals: [...index.origins.values()].filter((r) => r.origin !== "unknown")
        .length,
    }),
    [index],
  );
  const [query, setQuery] = useState(initialUsername),
    [chosen, setSelected] = useState(initialUsername);
  const selected = username ?? chosen;
  const [matches, setMatches] = useState<string[] | null>(null);
  const [view, setView] = useState<View>("Summary");
  const [confirmedDataset, setConfirmedDataset] = useState<Dataset | null>(
    null,
  );
  const [datedDataset, setDatedDataset] = useState({
    dataset,
    date: currentExportDate ?? "",
  });
  const exportDate =
    datedDataset.dataset === dataset
      ? datedDataset.date
      : (currentExportDate ?? "");
  const [saved, setSaved] = useState<{
    dataset: Dataset;
    signature: string;
    index: RelationshipHistoryIndex;
  } | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const confirmed = !!fictional || confirmedDataset === dataset;
  const history =
    saved?.dataset === dataset && saved.signature === signature && confirmed
      ? saved.index
      : undefined;
  useEffect(() => {
    if (!preset || !fictional) return;
    let active = true;
    load()
      .then((result) => {
        if (active) setSaved({ dataset, signature, index: result });
      })
      .catch((error) => {
        if (active) setError(vaultStorageMessage(error));
      });
    return () => {
      active = false;
    };
  }, [dataset, fictional, load, signature, preset]);
  const snapshotCount = (fictional ?? vault).length;
  const summary = useMemo(
    () => (selected ? timelineAccountSummary(selected, index, history) : null),
    [selected, index, history],
  );
  const context = useMemo(
    () =>
      selected
        ? timelineAccountContext(
            selected,
            index,
            history,
            exportDate,
            confirmed,
          )
        : null,
    [selected, index, history, exportDate, confirmed],
  );
  const originLabel =
    summary?.origin?.origin === "they-first"
      ? "They followed you first"
      : summary?.origin
        ? mutualOriginLabels[summary.origin.origin]
        : "";
  const includeHistory = useCallback(async () => {
    if (!confirmed || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await load();
      if (alive.current) setSaved({ dataset, signature, index: result });
    } catch (error) {
      if (alive.current) setError(vaultStorageMessage(error));
    } finally {
      if (alive.current) setBusy(false);
    }
  }, [busy, confirmed, dataset, load, signature]);
  const choose = useCallback(
    (name: string) => {
      setSelected(name);
      setQuery(name);
      setMatches(null);
      setView("Summary");
      setError("");
      if (fictional && !history) void includeHistory();
    },
    [fictional, history, includeHistory],
  );
  useEffect(() => {
    if (drawer) return;
    const inspect = (event: Event) => {
      const name = normalizeUsername((event as CustomEvent<unknown>).detail);
      if (name && (index.names.has(name) || history?.names.has(name)))
        choose(name);
    };
    window.addEventListener(RELATIONSHIP_INSPECTION_EVENT, inspect);
    return () =>
      window.removeEventListener(RELATIONSHIP_INSPECTION_EVENT, inspect);
  }, [choose, drawer, history, index]);
  function search(event: React.FormEvent) {
    event.preventDefault();
    const name = normalizeUsername(query);
    if (!name) {
      setError("Enter a valid username or Instagram profile URL.");
      return;
    }
    const names = new Set([...index.names, ...(history?.names ?? [])]);
    const found = names.has(name)
      ? [name]
      : [...names]
          .filter((n) => n.includes(name))
          .sort()
          .slice(0, 20);
    setError("");
    setSelected("");
    setMatches(found);
    if (found.length === 1) choose(found[0]);
  }
  return (
    <section
      className={`timeline-account${drawer ? " drawer-inspector" : ""}`}
      aria-label="Inspect a relationship"
    >
      {!drawer && (
        <>
          <h3>Understand one relationship</h3>
          <p>
            Search locally for an account in this export. Recorded dates, saved
            observations and optional export context stay distinct.
          </p>
        </>
      )}
      {!drawer && !selected && (
        <dl className="timeline-coverage" aria-label="Relationship coverage">
          <div>
            <dt>Dated followers</dt>
            <dd>{coverage.followers}</dd>
          </div>
          <div>
            <dt>Dated following</dt>
            <dd>{coverage.following}</dd>
          </div>
          <div>
            <dt>Mutuals with both dates</dt>
            <dd>{coverage.mutuals}</dd>
          </div>
          <div>
            <dt>
              {fictional
                ? "Fictional saved snapshots"
                : "Saved snapshots available"}
            </dt>
            <dd>{snapshotCount}</dd>
          </div>
        </dl>
      )}
      {!drawer && (
        <form className="timeline-account-search" onSubmit={search}>
          <label>
            Search relationship account
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={200}
              required
            />
          </label>
          <button type="submit">Inspect account</button>
        </form>
      )}
      {!drawer && fictional && (
        <label className="timeline-example">
          Fictional example
          <select
            value={examples.some(([name]) => name === selected) ? selected : ""}
            onChange={(e) => {
              if (e.target.value) choose(e.target.value);
            }}
          >
            <option value="">Choose an example</option>
            {examples.map(([name, label]) => (
              <option key={name} value={name}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}
      {snapshotCount > 0 && (
        <details className="timeline-history-options">
          <summary>Include saved history</summary>
          <p>
            {fictional
              ? "These are separate fictional examples; real Vault records are never used."
              : "Saved exports must belong to the same Instagram account as the active export. InstaScope cannot verify account identity."}
          </p>
          {!fictional && (
            <label>
              <input
                type="checkbox"
                checked={confirmedDataset === dataset}
                onChange={(e) =>
                  setConfirmedDataset(e.target.checked ? dataset : null)
                }
              />{" "}
              I confirm the active export and saved snapshots belong to the same
              Instagram account.
            </label>
          )}
          <button
            type="button"
            disabled={!confirmed || busy}
            onClick={() => void includeHistory()}
          >
            {busy ? "Reading local history…" : "Load saved history"}
          </button>
          {history && (
            <p role="status">
              {history.snapshots.length} readable{" "}
              {fictional ? "fictional " : ""}snapshots loaded.
            </p>
          )}
          <label>
            Active export date (optional)
            <input
              type="date"
              value={exportDate}
              onChange={(e) =>
                setDatedDataset({ dataset, date: e.target.value })
              }
            />
          </label>
          <p>
            Enter the date this export represents to show “previously” context
            from strictly earlier snapshots. Import time is not used as an
            export date.
          </p>
        </details>
      )}
      {error && <p role="alert">{error}</p>}
      {matches && !matches.length && (
        <p role="status">
          No matching account in this export or loaded saved history.
        </p>
      )}
      {matches && matches.length > 1 && (
        <div
          className="timeline-matches"
          aria-label="Matching relationship accounts"
        >
          {matches.map((name) => (
            <button type="button" key={name} onClick={() => choose(name)}>
              {display(name)}
            </button>
          ))}
          <p>Up to 20 matches. Enter a full username to narrow the search.</p>
        </div>
      )}
      <div
        className="category-tabs"
        role="group"
        aria-label="Account detail views"
      >
        {(["Summary", "Saved History", "Context"] as View[]).map((label) => (
          <button
            type="button"
            key={label}
            aria-pressed={view === label}
            onClick={() => setView(label)}
          >
            {drawer && label === "Saved History" ? "History" : label}
          </button>
        ))}
      </div>
      {!drawer && selected && <h4>{display(selected)}</h4>}
      {view === "Summary" && (
        <section aria-label="Account summary">
          {!summary ? (
            <p>Select an account to see its recorded relationship summary.</p>
          ) : (
            <>
              <dl className="relationship-summary">
                <div>
                  <dt>State in active export</dt>
                  <dd>
                    {summary.state
                      ? relationshipStateLabels[summary.state]
                      : "Not present in this export’s Followers or Following"}
                  </dd>
                </div>
                <div>
                  <dt>Recorded first</dt>
                  <dd>
                    {summary.origin
                      ? summary.origin.origin === "unknown"
                        ? "Recorded first unavailable"
                        : originLabel
                      : "Not applicable: not mutual in this export"}
                  </dd>
                </div>
                <div>
                  <dt>Follower date</dt>
                  <dd>{date(summary.follower)}</dd>
                </div>
                <div>
                  <dt>Following date</dt>
                  <dd>{date(summary.following)}</dd>
                </div>
                <div>
                  <dt>Saved snapshots containing this username</dt>
                  <dd>
                    {history
                      ? `${summary.containingSnapshots} of ${summary.readableSnapshots} readable snapshots`
                      : "Saved history not loaded"}
                  </dd>
                </div>
                <div>
                  <dt>Observed state changes</dt>
                  <dd>
                    {summary.transitions?.length ?? "Saved history not loaded"}
                  </dd>
                </div>
                <div>
                  <dt>First present in saved snapshot</dt>
                  <dd>
                    {summary.firstPresent
                      ? formatSnapshotDate(summary.firstPresent)
                      : history
                        ? "Not observed"
                        : "Saved history not loaded"}
                  </dd>
                </div>
                <div>
                  <dt>Latest present in saved snapshot</dt>
                  <dd>
                    {summary.latestPresent
                      ? formatSnapshotDate(summary.latestPresent)
                      : history
                        ? "Not observed"
                        : "Saved history not loaded"}
                  </dd>
                </div>
              </dl>
              <p>
                Active-export state is an observation in these lists, not live
                Instagram status. Saved presence does not establish what
                happened between exports.
              </p>
              {summary.origin && <p>{MUTUAL_ORIGIN_CAVEAT}</p>}
            </>
          )}
        </section>
      )}
      {view === "Saved History" && (
        <section
          className="vault-account-history timeline-saved-history"
          aria-label="Timeline saved history"
        >
          {!snapshotCount ? (
            <p>
              No saved snapshots yet.{" "}
              <Link
                href={
                  fictional ? "/snapshot-vault/?demo=true" : "/snapshot-vault/"
                }
              >
                Open Snapshot Vault
              </Link>{" "}
              to save an export and return with another.
            </p>
          ) : !history ? (
            <p>
              Use “Include saved history” above to confirm the same account and
              load readable snapshots.{" "}
              <Link href="/snapshot-vault/">Manage Snapshot Vault</Link>.
            </p>
          ) : !summary ? (
            <p>
              Search an account to review its saved observations. Loaded history
              also makes saved-only usernames searchable.
            </p>
          ) : !history.snapshots.length ? (
            <p>
              No readable saved snapshots. Corrupt records are skipped, not
              treated as absent observations.
            </p>
          ) : (
            <AccountHistoryDetails
              points={summary.points!}
              singleSnapshotMessage="More than one saved snapshot is needed to observe changes."
              transitionHeadingLevel={drawer ? 3 : 5}
            />
          )}
        </section>
      )}
      {view === "Context" && (
        <section aria-label="Account context">
          {!context ? (
            <p>
              Select an account to inspect supported export and saved-history
              facts.
            </p>
          ) : (
            <>
              <ContextHeading>Active export records</ContextHeading>
              {context.current.length ? (
                <ul className="context-facts">
                  {context.current.map((fact) => (
                    <li key={fact}>{fact}</li>
                  ))}
                  {summary?.origin && (
                    <li>
                      {summary.origin.origin === "unknown"
                        ? "Recorded first unavailable"
                        : `Recorded first: ${originLabel}`}
                    </li>
                  )}
                </ul>
              ) : (
                <p>
                  No supported current relationship or optional-category record
                  for this username. Missing categories do not establish
                  absence.
                </p>
              )}
              <ContextHeading>Earlier saved observations</ContextHeading>
              {!history ? (
                <p>Saved history not loaded.</p>
              ) : !validExportDate(exportDate) ? (
                <p>
                  Enter the active export date in “Include saved history” to
                  establish which snapshots are earlier.
                </p>
              ) : context.saved.length ? (
                <ul className="context-facts">
                  {context.saved.map((fact) => (
                    <li key={fact}>{fact}</li>
                  ))}
                </ul>
              ) : (
                <p>
                  No earlier membership context was established in readable
                  saved snapshots.
                </p>
              )}
              <p>
                Optional categories come only from the active export. A sent
                request record does not prove it is still pending. Privacy
                records do not prove current settings or continuity; unfollow
                history describes your own recorded actions. No cause, score or
                recommendation is inferred. This private account context is not
                added to Wrapped or shared cards.
              </p>
              {summary?.origin && <p>{MUTUAL_ORIGIN_CAVEAT}</p>}
            </>
          )}
        </section>
      )}
    </section>
  );
}
