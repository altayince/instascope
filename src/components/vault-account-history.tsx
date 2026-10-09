"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useData } from "./data-provider";
import {
  normalizeUsername,
  isDeletedInstagramAccount,
} from "@/lib/instagram/normalize";
import {
  accountHistory,
  historyTransitions,
  relationshipHistoryIndex,
  relationshipStateLabels,
  type RelationshipHistoryPoint,
  type RelationshipHistoryIndex,
} from "@/lib/analysis/relationship-history";
import {
  mutualOrigins,
  mutualOriginLabels,
  MUTUAL_ORIGIN_CAVEAT,
} from "@/lib/analysis/mutual-origins";
import { formatSnapshotDate, type VaultSnapshot } from "@/lib/snapshot-vault";
import { vaultStorageMessage } from "@/lib/vault-storage";

export function useVaultHistoryIndex(fictional?: readonly VaultSnapshot[]) {
  const { vault, readVaultHistory } = useData();
  const signature = `${fictional ? "demo" : "real"}:${(fictional ?? vault).map((s) => `${s.id}:${s.createdAt}:${s.exportDate}`).join("|")}`;
  const cache = useRef<{
    signature: string;
    promise: Promise<RelationshipHistoryIndex>;
  } | null>(null);
  async function load() {
    if (cache.current?.signature === signature) return cache.current.promise;
    const promise = fictional
      ? Promise.resolve(relationshipHistoryIndex(fictional))
      : readVaultHistory().then(relationshipHistoryIndex);
    cache.current = { signature, promise };
    try {
      return await promise;
    } catch (error) {
      if (cache.current?.promise === promise) cache.current = null;
      throw error;
    }
  }
  return { signature, load };
}
const display = (name: string) =>
  isDeletedInstagramAccount(name) ? "Deleted account" : `@${name}`;
export function VaultAccountHistory({
  fictional,
}: {
  fictional?: VaultSnapshot[];
}) {
  const { dataset, vault } = useData();
  const { signature, load } = useVaultHistoryIndex(fictional);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [result, setResult] = useState<{
    signature: string;
    matches: string[];
    selected: string;
    points: RelationshipHistoryPoint[];
  } | null>(null);
  const [confirmActive, setConfirmActive] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const shown = result?.signature === signature ? result : null;
  const activeMatchesSource =
    dataset && !!dataset.metadata.demo === !!fictional;
  const origins = useMemo(
    () => (dataset ? mutualOrigins(dataset) : []),
    [dataset],
  );
  const currentOrigin =
    shown?.selected && activeMatchesSource && (fictional || confirmActive)
      ? origins.find((r) => r.username === shown.selected)
      : undefined;
  async function search(event: React.FormEvent) {
    event.preventDefault();
    const normalized = normalizeUsername(query);
    if (!normalized) {
      setError("Enter a valid username or Instagram profile URL.");
      return;
    }
    if (busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    setConfirmActive(false);
    try {
      const index = await load();
      const matches = index.names.has(normalized)
        ? [normalized]
        : [...index.names]
            .filter((n) => n.includes(normalized))
            .sort()
            .slice(0, 20);
      if (mounted.current)
        setResult({
          signature,
          matches,
          selected: matches.length === 1 ? matches[0] : "",
          points: matches.length === 1 ? accountHistory(matches[0], index) : [],
        });
    } catch (error) {
      if (mounted.current) setError(vaultStorageMessage(error));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function select(name: string) {
    setError("");
    try {
      const index = await load();
      if (!mounted.current) return;
      setConfirmActive(false);
      setResult({
        signature,
        matches: [name],
        selected: name,
        points: accountHistory(name, index),
      });
    } catch (error) {
      if (mounted.current) setError(vaultStorageMessage(error));
    }
  }
  return (
    <section
      className="vault-account-history"
      aria-label="Account relationship history"
    >
      <h2>Account relationship history</h2>
      <p>
        Review username presence in readable saved snapshots. Make sure they
        belong to the same Instagram account; usernames cannot verify identity
        or establish a rename.
      </p>
      <form className="vault-actions" onSubmit={(e) => void search(e)}>
        <label>
          Search account history{" "}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={200}
            required
          />
        </label>
        <button
          type="submit"
          disabled={busy || !(fictional?.length ?? vault.length)}
        >
          {busy ? "Reading local history…" : "Search history"}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {shown && !shown.matches.length && (
        <p role="status">No matching username in readable saved history.</p>
      )}
      {shown && !shown.selected && shown.matches.length > 0 && (
        <div className="vault-actions" aria-label="Matching accounts">
          {shown.matches.map((name) => (
            <button key={name} onClick={() => void select(name)}>
              {display(name)}
            </button>
          ))}
          <p>Up to 20 matches. Enter a full username to narrow the search.</p>
        </div>
      )}
      {shown?.selected && (
        <>
          <h3>{display(shown.selected)}</h3>
          <table>
            <caption>Observed state in each saved snapshot</caption>
            <thead>
              <tr>
                <th scope="col">Snapshot date</th>
                <th scope="col">Observed state</th>
              </tr>
            </thead>
            <tbody>
              {shown.points.map((point) => (
                <tr key={point.snapshotId}>
                  <th scope="row">{formatSnapshotDate(point.exportDate)}</th>
                  <td>{relationshipStateLabels[point.state]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Absent means absent from Followers and Following in that snapshot.
            It does not establish an unfollow, block, deletion or cause.
          </p>
          {shown.points.length < 2 ? (
            <p>At least two saved snapshots are needed to observe changes.</p>
          ) : shown.points.filter((p) => p.state !== "absent").length === 1 ? (
            <p>
              This username appears in only one saved snapshot; its history is
              limited.
            </p>
          ) : null}
          <h3>Observed transitions</h3>
          {historyTransitions(shown.points).length ? (
            <ul className="history-transitions">
              {historyTransitions(shown.points).map((transition) => (
                <li key={`${transition.olderDate}:${transition.newerDate}`}>
                  <strong>
                    Observed between {formatSnapshotDate(transition.olderDate)}{" "}
                    and {formatSnapshotDate(transition.newerDate)}
                  </strong>
                  {transition.observations.map((text) => (
                    <p key={text}>{text}</p>
                  ))}
                </li>
              ))}
            </ul>
          ) : (
            <p>No state change observed in these saved snapshots.</p>
          )}
          <p>
            These observations do not establish exact change times,
            uninterrupted relationships or what happened between snapshots.
          </p>
          {activeMatchesSource && (
            <aside className="notice" aria-label="Current export origin">
              <h3>Current export · recorded origin</h3>
              {!fictional && (
                <label>
                  <input
                    type="checkbox"
                    checked={confirmActive}
                    onChange={(e) => setConfirmActive(e.target.checked)}
                  />{" "}
                  I confirm the active export and this saved history belong to
                  the same Instagram account.
                </label>
              )}
              {(fictional || confirmActive) && (
                <>
                  <p>
                    {currentOrigin
                      ? `Recorded first: ${mutualOriginLabels[currentOrigin.origin]}.`
                      : "No current mutual with two usable dates was established for this username."}
                  </p>
                  <p>{MUTUAL_ORIGIN_CAVEAT}</p>
                  <p>
                    This comes from the active export. Vault does not store
                    relationship dates or past origins.
                  </p>
                </>
              )}
            </aside>
          )}
        </>
      )}
    </section>
  );
}
