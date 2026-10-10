"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useMemo, useRef, useState } from "react";
import { demoVaultSnapshots } from "@/lib/demo";
import { useData } from "./data-provider";
import { SnapshotSaver } from "./snapshot-return";
import { VaultConfirmation } from "./vault-confirmation";
import { VaultAccountHistory } from "./vault-account-history";
import {
  SnapshotComparisonResults,
  type SnapshotComparison,
} from "./snapshot-comparison-results";
import {
  compareVaultSnapshots,
  formatSnapshotDate,
  MAX_BACKUP_BYTES,
  parseVaultBackup,
  previewVaultImport,
  vaultComparisonError,
  vaultSummary,
  type VaultSnapshot,
  type VaultBackup,
  type VaultSummary,
} from "@/lib/snapshot-vault";
import { vaultStorageMessage } from "@/lib/vault-storage";

function SnapshotHistory({ snapshots }: { snapshots: VaultSummary[] }) {
  const history = [...snapshots].reverse();
  const first = Date.parse(history[0].exportDate),
    last = Date.parse(history.at(-1)!.exportDate);
  const max = history.reduce(
    (max, s) => Math.max(max, s.followersCount, s.followingCount),
    1,
  );
  return (
    <section className="vault-history" aria-labelledby="history-heading">
      <h2 id="history-heading">Your saved history</h2>
      <p>Each point is a saved export snapshot, not continuous monitoring.</p>
      <div className="vault-legend">
        <span>● Followers</span>
        <span>● Following</span>
      </div>
      <svg className="vault-trend" viewBox="0 0 600 180" aria-hidden="true">
        {[20, 80, 140].map((y) => (
          <line
            key={y}
            className="vault-trend-grid"
            x1="20"
            x2="580"
            y1={y}
            y2={y}
          />
        ))}
        {history.map((s) => {
          const x =
            last === first
              ? 300
              : 20 +
                ((Date.parse(s.exportDate) - first) / (last - first)) * 560;
          return (
            <g key={s.id}>
              <circle
                cx={x}
                cy={140 - (s.followersCount / max) * 120}
                r="5"
                className="vault-followers-point"
              />
              <circle
                cx={x}
                cy={140 - (s.followingCount / max) * 120}
                r="3"
                className="vault-following-point"
              />
            </g>
          );
        })}
        <text
          className="vault-trend-date"
          x={first === last ? 300 : 20}
          y="170"
          textAnchor={first === last ? "middle" : "start"}
        >
          {formatSnapshotDate(history[0].exportDate)}
        </text>
        {first !== last && (
          <text className="vault-trend-date" x="580" y="170" textAnchor="end">
            {formatSnapshotDate(history.at(-1)!.exportDate)}
          </text>
        )}
      </svg>
      <table>
        <caption>Totals recorded in each saved export</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Followers</th>
            <th scope="col">Following</th>
          </tr>
        </thead>
        <tbody>
          {history.map((s) => (
            <tr key={s.id}>
              <th scope="row">{formatSnapshotDate(s.exportDate)}</th>
              <td>{s.followersCount.toLocaleString("en-US")}</td>
              <td>{s.followingCount.toLocaleString("en-US")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

type Comparison = {
  older: VaultSummary;
  newer: VaultSummary;
  result: SnapshotComparison;
};
export function SnapshotVault() {
  const params = useSearchParams();
  const router = useRouter();
  const demo = params.get("demo") === "true";
  const fictional = useMemo(() => demoVaultSnapshots(), []);
  return (
    <VaultContents
      key={demo ? "demo" : "real"}
      fictional={demo ? fictional : undefined}
      onToggleDemo={() =>
        router.replace(
          demo ? "/snapshot-vault/" : "/snapshot-vault/?demo=true",
          { scroll: false },
        )
      }
    />
  );
}
function VaultContents({
  fictional,
  onToggleDemo,
}: {
  fictional?: VaultSnapshot[];
  onToggleDemo: () => void;
}) {
  const {
    dataset,
    vault: realVault,
    storageReady,
    storageError,
    storageWarning,
    corruptSnapshots,
    refreshVault,
    retryVault,
    readSnapshot,
    removeSnapshot,
    exportVault,
    importVault,
  } = useData();
  const demo = !!fictional;
  const vault = fictional ? fictional.map(vaultSummary) : realVault;
  const [olderId, setOlderId] = useState("");
  const [newerId, setNewerId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [confirmedRevision, setConfirmedRevision] = useState("");
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [deletion, setDeletion] = useState<VaultSummary | "all" | null>(null);
  const [backup, setBackup] = useState<VaultBackup | null>(null);
  const [importing, setImporting] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const modalTrigger = useRef<HTMLButtonElement | null>(null);
  const id = useId();
  const older = vault.find((s) => s.id === olderId),
    newer = vault.find((s) => s.id === newerId);
  const revision = `${older?.id}:${older?.createdAt}|${newer?.id}:${newer?.createdAt}`;
  const sameAccountConfirmed = confirmed && confirmedRevision === revision;
  const preview = backup ? previewVaultImport(backup, vault) : null;
  const displayedComparison =
    comparison &&
    comparison.older.id === olderId &&
    comparison.newer.id === newerId &&
    vault.some(
      (s) =>
        s.id === comparison.older.id &&
        s.createdAt === comparison.older.createdAt,
    ) &&
    vault.some(
      (s) =>
        s.id === comparison.newer.id &&
        s.createdAt === comparison.newer.createdAt,
    )
      ? comparison
      : null;
  function select(which: "older" | "newer", value: string) {
    if (which === "older") setOlderId(value);
    else setNewerId(value);
    setConfirmed(false);
    setComparison(null);
    setError("");
  }
  function choosePair(snapshot: VaultSummary) {
    const chronological = [...vault].reverse(),
      index = chronological.findIndex((s) => s.id === snapshot.id);
    setOlderId(index > 0 ? chronological[index - 1].id : snapshot.id);
    setNewerId(index > 0 ? snapshot.id : (chronological[1]?.id ?? ""));
    setConfirmed(false);
    setComparison(null);
    setError("");
    document.getElementById(`${id}-older`)?.focus();
  }
  async function compare() {
    setError("");
    setComparison(null);
    if (!older || !newer) {
      setError("Choose an older and a newer saved snapshot.");
      return;
    }
    const invalid = vaultComparisonError(older, newer, sameAccountConfirmed);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    try {
      const [first, second] = await Promise.all([
        fictional
          ? Promise.resolve(fictional.find((s) => s.id === older.id)!)
          : readSnapshot(older.id),
        fictional
          ? Promise.resolve(fictional.find((s) => s.id === newer.id)!)
          : readSnapshot(newer.id),
      ]);
      if (
        first.createdAt !== older.createdAt ||
        second.createdAt !== newer.createdAt
      ) {
        await refreshVault();
        setError(
          "A selected snapshot changed. Choose the dates and confirm again.",
        );
        setConfirmed(false);
        return;
      }
      setComparison({
        older,
        newer,
        result: compareVaultSnapshots(first, second, sameAccountConfirmed),
      });
    } catch (error) {
      setError(vaultStorageMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <span className="eyebrow">LOCAL HISTORY</span>
      <h1>Snapshot Vault</h1>
      <p className="lead">Your locally saved Instagram history.</p>
      <p>
        Save an export today, then return with a newer export to see what
        changed. Only follower and following usernames, export dates and local
        snapshot metadata are saved in this browser. No archive or private
        connection lists.
      </p>
      <div className="vault-actions">
        <Link className="button secondary" href="/dashboard/">
          Back to Dashboard
        </Link>
        <Link className="button secondary" href="/snapshot-comparison/">
          Compare with a current export
        </Link>
        <Link className="button tertiary" href="/privacy/">
          Privacy
        </Link>
      </div>
      <button
        type="button"
        className="button tertiary"
        disabled={busy || importing || !!deletion}
        onClick={onToggleDemo}
      >
        {demo ? "Exit demo" : "Try Vault demo"}
      </button>
      {demo && (
        <p className="notice" role="status">
          Demo data · Fictional history. Your real saved snapshots are
          unchanged.
        </p>
      )}
      {!demo && <SnapshotSaver />}
      {!demo && dataset?.metadata.demo && (
        <p className="notice">
          Demo data · Fictional example. Demo exports cannot be saved. Your real
          saved history remains separate.
        </p>
      )}
      {!demo && (
        <p className="muted">
          Clearing browser/site data may delete this history. There is no cloud
          backup. Export a private backup before moving browsers or clearing
          storage.
        </p>
      )}
      {!demo && !storageReady && <p role="status">Opening local history…</p>}
      {!demo && storageError && (
        <div className="notice" role="alert">
          <p>{storageError}</p>
          <button
            type="button"
            onClick={async () => {
              try {
                await retryVault();
              } catch (error) {
                setError(vaultStorageMessage(error));
              }
            }}
          >
            Retry local storage
          </button>
        </div>
      )}
      {!demo && storageWarning && <p role="status">{storageWarning}</p>}
      {!demo && corruptSnapshots > 0 && (
        <p role="alert">
          {corruptSnapshots} unreadable saved record
          {corruptSnapshots === 1 ? " was" : "s were"} skipped, without deleting
          it. Comparisons and backups include only valid snapshots. Delete all
          saved snapshots to remove unreadable records too.
        </p>
      )}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {(demo || (storageReady && !storageError)) && (
        <>
          <dl className="vault-overview" aria-label="Vault at a glance">
            <div>
              <dt>Saved snapshots</dt>
              <dd>{vault.length.toLocaleString("en-US")}</dd>
            </div>
            <div>
              <dt>Latest export date</dt>
              <dd>
                {vault[0]
                  ? formatSnapshotDate(vault[0].exportDate)
                  : "No saved history yet"}
              </dd>
            </div>
            <div>
              <dt>Comparison</dt>
              <dd>
                {vault.length >= 2
                  ? "Choose two saved dates"
                  : "Save a newer export next"}
              </dd>
            </div>
          </dl>
          <section className="vault-list" aria-label="Saved snapshots">
            <h2>
              Saved snapshots <span className="muted">({vault.length})</span>
            </h2>
            {!vault.length ? (
              <div className="empty-state">
                <h3>No snapshots saved yet.</h3>
                <p>
                  Save an export today, then return with a newer export to see
                  what changed.
                </p>
                <Link className="button secondary" href="/dashboard/">
                  Upload an export in Dashboard
                </Link>
              </div>
            ) : (
              <ul>
                {vault.map((snapshot) => (
                  <li className="vault-row" key={snapshot.id}>
                    <div className="vault-row-meta">
                      <h3>{formatSnapshotDate(snapshot.exportDate)}</h3>
                      <p>
                        {snapshot.followersCount.toLocaleString("en-US")}{" "}
                        followers ·{" "}
                        {snapshot.followingCount.toLocaleString("en-US")}{" "}
                        following
                      </p>
                      <small className="muted">
                        {demo ? "Fictional snapshot · " : "Saved "}
                        {new Intl.DateTimeFormat("en-GB", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(snapshot.createdAt)}
                      </small>
                    </div>
                    <div className="vault-actions">
                      <button
                        className="button secondary"
                        type="button"
                        disabled={busy || vault.length < 2}
                        onClick={() => choosePair(snapshot)}
                        aria-label={`Compare ${formatSnapshotDate(snapshot.exportDate)}`}
                      >
                        Compare
                      </button>
                      <button
                        className="button danger"
                        type="button"
                        disabled={demo}
                        onClick={(event) => {
                          modalTrigger.current = event.currentTarget;
                          setDeletion(snapshot);
                        }}
                        aria-label={`Delete ${formatSnapshotDate(snapshot.exportDate)}`}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {vault.length > 0 && (
            <section
              className="vault-compare"
              aria-labelledby={`${id}-compare`}
            >
              <h2 id={`${id}-compare`}>Compare two saved snapshots</h2>
              <p>
                {demo ? (
                  "These four fictional snapshots represent one example account. Confirm this to try the same-account comparison flow."
                ) : (
                  <>
                    You are responsible for confirming both snapshots belong to
                    the same Instagram account. InstaScope cannot verify account
                    identity.
                  </>
                )}
              </p>
              {vault.length < 2 && (
                <p>
                  Save another export with a later date to compare your history.
                </p>
              )}
              <div className="vault-date-pair">
                <div>
                  <div className="vault-step-heading">
                    <span className="vault-step-number" aria-hidden="true">
                      1
                    </span>
                    <label htmlFor={`${id}-older`}>Older snapshot</label>
                  </div>
                  <select
                    id={`${id}-older`}
                    value={olderId}
                    disabled={busy}
                    onChange={(e) => select("older", e.target.value)}
                  >
                    <option value="">Choose a date</option>
                    {vault.map((s) => (
                      <option key={s.id} value={s.id}>
                        {formatSnapshotDate(s.exportDate)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="vault-step-heading">
                    <span className="vault-step-number" aria-hidden="true">
                      2
                    </span>
                    <label htmlFor={`${id}-newer`}>Newer snapshot</label>
                  </div>
                  <select
                    id={`${id}-newer`}
                    value={newerId}
                    disabled={busy}
                    onChange={(e) => select("newer", e.target.value)}
                  >
                    <option value="">Choose a date</option>
                    {vault.map((s) => (
                      <option key={s.id} value={s.id}>
                        {formatSnapshotDate(s.exportDate)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="snapshot-account-confirmation">
                <input
                  type="checkbox"
                  required
                  checked={sameAccountConfirmed}
                  disabled={busy}
                  onChange={(e) => {
                    setConfirmed(e.target.checked);
                    setConfirmedRevision(revision);
                    setComparison(null);
                  }}
                />
                {demo
                  ? "These fictional snapshots represent the same example account."
                  : "These exports are from the same Instagram account."}
              </label>
              <button
                className="button primary"
                type="button"
                disabled={busy || !sameAccountConfirmed || !older || !newer}
                onClick={compare}
              >
                {busy ? "Comparing locally…" : "Compare saved snapshots"}
              </button>
              {displayedComparison && (
                <div className="vault-results">
                  <p>
                    {formatSnapshotDate(displayedComparison.older.exportDate)} →{" "}
                    {formatSnapshotDate(displayedComparison.newer.exportDate)}
                  </p>
                  <SnapshotComparisonResults
                    comparison={displayedComparison.result}
                    demo={demo}
                  />
                </div>
              )}
            </section>
          )}
          {vault.length > 0 && <SnapshotHistory snapshots={vault} />}
          {vault.length > 0 && <VaultAccountHistory fictional={fictional} />}
          {demo ? (
            <section className="vault-backup" aria-label="Demo storage safety">
              <h2>Fictional history stays in memory</h2>
              <p>
                Backup, import and deletion are disabled in this demo. Exit demo
                to manage your real saved history.
              </p>
              <div className="vault-actions">
                <button className="button secondary" disabled>
                  Export Vault backup
                </button>
                <button className="button secondary" disabled>
                  Import Vault backup
                </button>
                <button className="button danger" disabled>
                  Delete all saved snapshots
                </button>
              </div>
            </section>
          ) : (
            <section
              className="vault-backup vault-maintenance"
              aria-labelledby={`${id}-backup`}
            >
              <h2 id={`${id}-backup`}>Keep a private backup</h2>
              <p>
                This JSON file contains follower and following usernames. Keep
                it private. Import accepts only InstaScope Vault V1 backups up
                to 32 MB; existing export dates are kept and skipped, never
                silently overwritten.
              </p>
              <div className="vault-actions">
                <button
                  className="button secondary"
                  type="button"
                  disabled={busy || !vault.length}
                  onClick={async () => {
                    setError("");
                    setBusy(true);
                    try {
                      const raw = await exportVault(),
                        url = URL.createObjectURL(
                          new Blob([raw], { type: "application/json" }),
                        );
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = "instascope-snapshot-vault.json";
                      link.click();
                      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                      setMessage("Private Vault backup exported locally.");
                    } catch (error) {
                      setError(vaultStorageMessage(error));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Export Vault backup
                </button>
                <label className="vault-import">
                  Import Vault backup
                  <input
                    ref={input}
                    type="file"
                    accept=".json,application/json"
                    disabled={busy}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      setBackup(null);
                      setError("");
                      setMessage("");
                      if (!file) return;
                      setBusy(true);
                      try {
                        if (file.size > MAX_BACKUP_BYTES)
                          throw new Error(
                            "Vault backups must be 32 MB or smaller.",
                          );
                        setBackup(parseVaultBackup(await file.text()));
                      } catch (error) {
                        setError(
                          error instanceof Error
                            ? error.message
                            : "This backup could not be read.",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                </label>
              </div>
              {backup && preview && (
                <div className="notice" aria-label="Backup import preview">
                  <h3>Preview before importing</h3>
                  <p>
                    {preview.added.length} new snapshot
                    {preview.added.length === 1 ? "" : "s"} · {preview.skipped}{" "}
                    existing date{preview.skipped === 1 ? "" : "s"} skipped.
                    Nothing has been saved yet.
                  </p>
                  <ul>
                    {backup.snapshots.map((s) => (
                      <li key={s.id}>
                        {formatSnapshotDate(s.exportDate)} ·{" "}
                        {s.followers.length} followers · {s.following.length}{" "}
                        following
                        {vault.some(
                          (existing) => existing.exportDate === s.exportDate,
                        )
                          ? " · already saved, kept"
                          : " · new"}
                      </li>
                    ))}
                  </ul>
                  <div className="vault-actions">
                    <button
                      className="button primary"
                      type="button"
                      disabled={busy || !preview.added.length}
                      onClick={(event) => {
                        modalTrigger.current = event.currentTarget;
                        setImporting(true);
                      }}
                    >
                      Import snapshots
                    </button>
                    <button
                      className="button tertiary"
                      type="button"
                      onClick={() => {
                        setBackup(null);
                        if (input.current) input.current.value = "";
                      }}
                    >
                      Cancel import
                    </button>
                  </div>
                </div>
              )}
              <div className="vault-danger-zone">
                <div>
                  <h3>Remove local history</h3>
                  <p>
                    Deletion removes saved snapshots from this browser. Your
                    active export stays available.
                  </p>
                </div>
                <button
                  className="button danger vault-delete-all"
                  type="button"
                  disabled={!vault.length && !corruptSnapshots}
                  onClick={(event) => {
                    modalTrigger.current = event.currentTarget;
                    setDeletion("all");
                  }}
                >
                  Delete all saved snapshots
                </button>
              </div>
            </section>
          )}
        </>
      )}
      {!demo && deletion && (
        <VaultConfirmation
          returnFocus={modalTrigger}
          title={
            deletion === "all"
              ? "Delete all saved snapshots?"
              : "Delete this saved snapshot?"
          }
          action={
            deletion === "all" ? "Delete all snapshots" : "Delete snapshot"
          }
          strong={deletion === "all"}
          danger
          onCancel={() => setDeletion(null)}
          onConfirm={async () => {
            await removeSnapshot(deletion === "all" ? undefined : deletion.id);
            setComparison(null);
            setConfirmed(false);
            setMessage(
              deletion === "all"
                ? "All saved snapshots deleted. Your active export was kept."
                : "Saved snapshot deleted. Your active export was kept.",
            );
          }}
        >
          <p>
            {deletion === "all"
              ? "This permanently removes all saved history from this browser, including the legacy saved copy. Export a private backup first if you want to keep it."
              : `${formatSnapshotDate(deletion.exportDate)} will be removed from this browser.`}{" "}
            Your currently loaded export will stay available.
          </p>
        </VaultConfirmation>
      )}
      {!demo && importing && backup && preview && (
        <VaultConfirmation
          returnFocus={modalTrigger}
          title="Merge this Vault backup?"
          action="Confirm import"
          onCancel={() => setImporting(false)}
          onConfirm={async () => {
            const result = await importVault(backup);
            setMessage(
              `${result.added} snapshots imported locally · ${result.skipped} existing dates skipped.`,
            );
            setBackup(null);
            if (input.current) input.current.value = "";
          }}
        >
          <p>
            {preview.added.length} new snapshots will be saved locally. Existing
            dates are kept. Your active export will not change.
          </p>
        </VaultConfirmation>
      )}
    </>
  );
}
