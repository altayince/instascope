"use client";
import { useState } from "react";
import Link from "next/link";
import { useData } from "./data-provider";

export function SavedSnapshotNotice() {
  const { saved, storageReady, deleteSaved } = useData();
  const [message, setMessage] = useState("");
  if (!storageReady) return null;
  if (!saved) return message ? <p role="status">{message}</p> : null;
  return (
    <div className="snapshot-return" role="status">
      <strong>Saved local snapshot · {saved.exportDate}</strong>
      <p>
        This browser still has your saved follower and following usernames.
        Upload a newer export from the same account, then choose the saved one
        as older in <Link href="/snapshot-comparison/">Compare Snapshots</Link>.
        Nothing is compared automatically.
      </p>
      <button
        onClick={() => {
          const error = deleteSaved();
          setMessage(error ?? "Saved snapshot deleted from this browser.");
        }}
      >
        Delete saved snapshot
      </button>
      <p>Clearing browser/site data may also remove this saved copy.</p>
      {message && <p>{message}</p>}
    </div>
  );
}

export function SnapshotSaver() {
  const {
    dataset,
    saved,
    storageReady,
    storageError,
    saveCurrent,
    deleteSaved,
  } = useData();
  const [exportDate, setExportDate] = useState("");
  const [message, setMessage] = useState("");
  if (!dataset || dataset.metadata.demo) return null;
  return (
    <section className="snapshot-return" aria-label="Save a local snapshot">
      <h3>Keep a snapshot for next time</h3>
      <p>
        Save only follower and following usernames in this browser. Your ZIP,
        private lists and relationship dates are not stored. Come back with a
        newer export from the same account to compare what changed.
      </p>
      {saved && (
        <p>
          <strong>Saved local snapshot · {saved.exportDate}</strong> ·{" "}
          {saved.followers.length.toLocaleString("en-US")} followers /{" "}
          {saved.following.length.toLocaleString("en-US")} following. Saving
          again replaces this copy and closes a comparison using it.
        </p>
      )}
      <div className="snapshot-return-controls">
        <label>
          Date this export represents
          <input
            type="date"
            value={exportDate}
            onChange={(event) => setExportDate(event.target.value)}
          />
        </label>
        <button
          disabled={!storageReady || !!storageError}
          onClick={() => {
            const error = saveCurrent(exportDate);
            setMessage(
              error ??
                `Saved locally as ${exportDate}. Return with a newer export.`,
            );
          }}
        >
          {saved
            ? "Replace saved snapshot"
            : "Save this snapshot for next time"}
        </button>
        {saved && (
          <button
            onClick={() => {
              const error = deleteSaved();
              setMessage(error ?? "Saved snapshot deleted from this browser.");
            }}
          >
            Delete saved snapshot
          </button>
        )}
      </div>
      <p className="snapshot-return-help">
        Enter the export date yourself; import time is not an export date. You
        control replacement and deletion. Clearing browser/site data may remove
        the saved snapshot. “Clear active data” removes the current session but
        keeps the saved copy.
      </p>
      {(storageError || message) && (
        <p role="status">{storageError || message}</p>
      )}
    </section>
  );
}

export function SavedComparisonChoice() {
  const {
    dataset,
    saved,
    older,
    storageReady,
    chooseSavedAsOlder,
    deleteSaved,
  } = useData();
  const [currentDate, setCurrentDate] = useState("");
  const [sameAccountConfirmed, setSameAccountConfirmed] = useState(false);
  const [message, setMessage] = useState("");
  if (!storageReady || !saved || !dataset || dataset.metadata.demo || older)
    return null;
  return (
    <section
      className="snapshot-return"
      aria-label="Compare with saved snapshot"
    >
      <h3>Use your saved local snapshot?</h3>
      <p>
        Saved older candidate: <strong>{saved.exportDate}</strong> ·{" "}
        {saved.followers.length.toLocaleString("en-US")} followers /{" "}
        {saved.following.length.toLocaleString("en-US")} following. It is not
        compared until you enter a newer date and confirm both exports are from
        the same account. InstaScope cannot verify account identity for you.
      </p>
      <label className="snapshot-account-confirmation">
        <input
          type="checkbox"
          required
          checked={sameAccountConfirmed}
          onChange={(event) => setSameAccountConfirmed(event.target.checked)}
        />
        I confirm this export is from the same Instagram account as the saved
        snapshot.
      </label>
      <div className="snapshot-return-controls">
        <label>
          Date of current export
          <input
            type="date"
            value={currentDate}
            onChange={(event) => setCurrentDate(event.target.value)}
          />
        </label>
        <button
          disabled={!sameAccountConfirmed}
          onClick={() => {
            const error = chooseSavedAsOlder(
              currentDate,
              sameAccountConfirmed,
            );
            setMessage(error ?? "Comparing with the saved older snapshot.");
          }}
        >
          Compare with saved snapshot
        </button>
        <button
          onClick={() => {
            const error = deleteSaved();
            setMessage(error ?? "Saved snapshot deleted from this browser.");
          }}
        >
          Delete saved snapshot
        </button>
      </div>
      <p className="snapshot-return-help">
        You are responsible for confirming both snapshots belong to the same
        Instagram account and checking their dates. InstaScope does not infer
        chronology from upload time. You can upload an older file manually
        instead.
      </p>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
