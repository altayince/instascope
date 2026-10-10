"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useData } from "./data-provider";
import { VaultConfirmation } from "./vault-confirmation";
import { formatSnapshotDate, type VaultSummary } from "@/lib/snapshot-vault";
import {
  DuplicateSnapshotError,
  vaultStorageMessage,
} from "@/lib/vault-storage";

export function SavedSnapshotNotice() {
  const { saved, vault, storageReady, storageError } = useData();
  if (!storageReady) return null;
  if (storageError) return <p role="status">{storageError}</p>;
  if (!saved) return null;
  return (
    <div className="snapshot-return" role="status">
      <strong>
        {vault.length} saved local{" "}
        {vault.length === 1 ? "snapshot" : "snapshots"} · Latest:{" "}
        {formatSnapshotDate(saved.exportDate)}
      </strong>
      <p>
        This browser still has your saved follower and following usernames.
        Upload a newer export from the same account, then choose an older one in{" "}
        <Link href="/snapshot-comparison/">Compare Snapshots</Link>, or compare
        two saved copies in <Link href="/snapshot-vault/">Snapshot Vault</Link>.
        Nothing is compared automatically.
      </p>
      <p>
        Clearing browser/site data may remove this history. Export a Vault
        backup to keep a copy.
      </p>
    </div>
  );
}
export function SnapshotSaver() {
  const { dataset, storageReady, storageError, saveCurrent } = useData();
  const [exportDate, setExportDate] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [replacement, setReplacement] = useState<VaultSummary | null>(null);
  const saveButton = useRef<HTMLButtonElement>(null);
  if (!dataset || dataset.metadata.demo) return null;
  async function save(replace?: VaultSummary) {
    setBusy(true);
    setMessage("");
    try {
      const snapshot = await saveCurrent(exportDate, replace);
      setMessage(
        `Snapshot saved locally · ${formatSnapshotDate(snapshot.exportDate)}`,
      );
    } catch (error) {
      if (error instanceof DuplicateSnapshotError && !replace)
        setReplacement(error.snapshot);
      else if (replace) throw error;
      else setMessage(vaultStorageMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="snapshot-return" aria-label="Save a local snapshot">
      <h3>Keep a snapshot for next time</h3>
      <p>
        Save only follower and following usernames in this browser. Your ZIP,
        private lists and relationship dates are not stored. Come back with a
        newer export from the same account to compare what changed.
      </p>
      <div className="snapshot-return-controls">
        <label>
          Date this export represents
          <input
            type="date"
            value={exportDate}
            onChange={(event) => {
              setExportDate(event.target.value);
              setMessage("");
            }}
          />
        </label>
        <button
          ref={saveButton}
          className="button primary"
          type="button"
          disabled={!storageReady || !!storageError || busy}
          onClick={() => void save()}
        >
          {busy ? "Saving locally…" : "Save snapshot"}
        </button>
        <Link className="button secondary" href="/snapshot-vault/">
          Open Vault
        </Link>
      </div>
      <p className="snapshot-return-help">
        Enter the export date yourself; import time is not an export date. Each
        different date adds to your history. The same date requires your
        confirmation to replace. “Clear active data” keeps your saved history.
      </p>
      {(storageError || message) && (
        <p role="status">{storageError || message}</p>
      )}
      {replacement && (
        <VaultConfirmation
          returnFocus={saveButton}
          title="Replace snapshot?"
          action="Replace snapshot"
          onCancel={() => setReplacement(null)}
          onConfirm={async () => {
            await save(replacement);
          }}
        >
          <p>
            A snapshot already exists for{" "}
            {formatSnapshotDate(replacement.exportDate)}. Replace its{" "}
            {replacement.followersCount} followers and{" "}
            {replacement.followingCount} following with this export? Other dates
            will be kept.
          </p>
        </VaultConfirmation>
      )}
    </section>
  );
}
export function SavedComparisonChoice() {
  const { dataset, vault, older, storageReady, chooseSavedAsOlder } = useData();
  const [selected, setSelected] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [sameAccountConfirmed, setSameAccountConfirmed] = useState(false);
  const [confirmedRevision, setConfirmedRevision] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const saved = vault.find((snapshot) => snapshot.id === selected) ?? vault[0];
  const revision = saved ? `${saved.id}:${saved.createdAt}` : "";
  const confirmed = sameAccountConfirmed && confirmedRevision === revision;
  if (!storageReady || !saved || !dataset || dataset.metadata.demo || older)
    return null;
  return (
    <section
      className="snapshot-return"
      aria-label="Compare with saved snapshot"
    >
      <h3>Choose an older Vault snapshot</h3>
      <p>
        Saved older candidate: <strong>{saved.exportDate}</strong> ·{" "}
        {saved.followersCount.toLocaleString("en-US")} followers /{" "}
        {saved.followingCount.toLocaleString("en-US")} following. It is not
        compared until you enter a newer date and confirm both exports are from
        the same account. InstaScope cannot verify account identity for you.
      </p>
      <label>
        Older saved snapshot
        <select
          disabled={busy}
          value={saved.id}
          onChange={(event) => {
            setSelected(event.target.value);
            setSameAccountConfirmed(false);
            setMessage("");
          }}
        >
          {vault.map((snapshot) => (
            <option key={snapshot.id} value={snapshot.id}>
              {formatSnapshotDate(snapshot.exportDate)} ·{" "}
              {snapshot.followersCount} followers / {snapshot.followingCount}{" "}
              following
            </option>
          ))}
        </select>
      </label>
      <label className="snapshot-account-confirmation">
        <input
          type="checkbox"
          required
          checked={confirmed}
          disabled={busy}
          onChange={(event) => {
            setSameAccountConfirmed(event.target.checked);
            setConfirmedRevision(revision);
          }}
        />
        I confirm this export is from the same Instagram account as the saved
        snapshot.
      </label>
      <div className="snapshot-return-controls">
        <label>
          Date of current export
          <input
            type="date"
            disabled={busy}
            value={currentDate}
            onChange={(event) => {
              setCurrentDate(event.target.value);
              setSameAccountConfirmed(false);
              setMessage("");
            }}
          />
        </label>
        <button
          className="button primary"
          disabled={!confirmed || busy}
          onClick={async () => {
            setBusy(true);
            const error = await chooseSavedAsOlder(
              currentDate,
              confirmed,
              saved.id,
              saved.createdAt,
            );
            setMessage(error ?? "Comparing with the saved older snapshot.");
            setBusy(false);
          }}
        >
          {busy ? "Opening saved snapshot…" : "Compare with saved snapshot"}
        </button>
        <Link href="/snapshot-vault/" className="button secondary">
          Open Vault
        </Link>
      </div>
      <p className="snapshot-return-help">
        You are responsible for confirming both snapshots belong to the same
        Instagram account and checking their dates. InstaScope does not infer
        chronology from upload time. You can upload an older file manually
        instead, or compare two saved copies in the Vault.
      </p>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
