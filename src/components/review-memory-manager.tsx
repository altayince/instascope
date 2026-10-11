"use client";
import { useId, useRef, useState } from "react";
import { ActionButton } from "./actions";
import { VaultConfirmation } from "./vault-confirmation";
import { useReviewMemory } from "./review-memory-provider";
import {
  MAX_REVIEW_BACKUP_BYTES,
  parseReviewMemoryBackup,
  type ReviewMemoryBackup,
} from "@/lib/review-memory";
import { reviewMemoryStorageMessage } from "@/lib/review-memory-storage";
import "./review-memory-manager.css";

export function ReviewMemoryManager({
  fictional = false,
}: {
  fictional?: boolean;
}) {
  const memory = useReviewMemory();
  const id = useId();
  const [backup, setBackup] = useState<ReviewMemoryBackup | null>(null);
  const [confirmation, setConfirmation] = useState<"import" | "clear" | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const trigger = useRef<HTMLButtonElement | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const demo = fictional || memory.demo;
  const disabled = !memory.ready || !!memory.error || busy;
  const records = [...memory.records.values()];
  return (
    <section className="review-memory-manager" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>Private Review Memory</h2>
      {demo ? (
        <p>
          Demo data · Fictional review memory. Decisions stay in memory only;
          real Review Memory, backups and deletion controls are separate.
        </p>
      ) : (
        <>
          <p>
            Keep, Reviewed, Watch and private notes are stored only in this
            browser. Clearing an export or deleting snapshots leaves them here.
          </p>
          {!memory.ready ? (
            <p role="status">Opening local Review Memory…</p>
          ) : !memory.error ? (
            <p>
              {records.length} readable account record
              {records.length === 1 ? "" : "s"} ·{" "}
              {records.filter((r) => r.keep).length} kept ·{" "}
              {records.filter((r) => r.reviewed).length} reviewed ·{" "}
              {records.filter((r) => r.watch).length} watched
            </p>
          ) : null}
          {!records.length &&
            memory.ready &&
            !memory.error &&
            !memory.corrupt && (
              <p>
                No Review Memory yet. Open an account’s relationship details to
                mark Keep, Reviewed or Watch, or add a private note.
              </p>
            )}
          {memory.warning && <p role="status">{memory.warning}</p>}
          {memory.error && (
            <div role="alert">
              <p>{memory.error}</p>
              <ActionButton type="button" onClick={() => void memory.retry()}>
                Retry local memory
              </ActionButton>
            </div>
          )}
          <p className="review-memory-backup-help">
            Review Memory backups are separate private JSON files containing
            usernames and notes. They never go to a server. Existing local
            records always win on import, even if a backup is newer; notes are
            never silently replaced. Vault V1 backups continue to work
            separately.
          </p>
          <div className="vault-actions">
            <ActionButton
              type="button"
              disabled={disabled || !records.length || !!memory.corrupt}
              onClick={async () => {
                setBusy(true);
                setError("");
                setMessage("");
                try {
                  const value = await memory.exportMemory();
                  const url = URL.createObjectURL(
                    new Blob([value], { type: "application/json" }),
                  );
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = "instascope-review-memory.json";
                  link.click();
                  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                  setMessage(
                    "Private Review Memory backup downloaded. Keep it safe.",
                  );
                } catch (error) {
                  setError(reviewMemoryStorageMessage(error));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Export Review Memory backup
            </ActionButton>
            <label className="review-memory-import">
              Import Review Memory backup
              <input
                ref={input}
                type="file"
                accept=".json,application/json"
                disabled={disabled}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  setBackup(null);
                  setError("");
                  setMessage("");
                  if (!file) return;
                  setBusy(true);
                  try {
                    if (file.size > MAX_REVIEW_BACKUP_BYTES)
                      throw new Error(
                        "Review Memory backup is too large. Nothing was imported.",
                      );
                    setBackup(parseReviewMemoryBackup(await file.text()));
                  } catch (error) {
                    setError(
                      error instanceof Error
                        ? error.message
                        : "This backup could not be read. Nothing was imported.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </label>
          </div>
          {backup && (
            <section
              className="notice"
              aria-label="Review Memory import preview"
            >
              <h3>Preview Review Memory import</h3>
              <p>
                {backup.records.length} incoming account records.{" "}
                {
                  backup.records.filter((r) => memory.records.has(r.username))
                    .length
                }{" "}
                match readable local records and will be kept locally. Nothing
                has been imported yet.
              </p>
              <p>
                All existing local records, including unreadable ones, are kept.
                This adds missing usernames only. Snapshot Vault and your active
                export are not changed.
              </p>
              <div className="vault-actions">
                <ActionButton
                  variant="primary"
                  type="button"
                  disabled={disabled || !backup.records.length}
                  onClick={(event) => {
                    trigger.current = event.currentTarget;
                    setConfirmation("import");
                  }}
                >
                  Import Review Memory
                </ActionButton>
                <ActionButton
                  variant="tertiary"
                  type="button"
                  onClick={() => {
                    setBackup(null);
                    if (input.current) input.current.value = "";
                  }}
                >
                  Cancel Review Memory import
                </ActionButton>
              </div>
            </section>
          )}
          <div className="vault-danger-zone">
            <div>
              <h3>Clear Review Memory</h3>
              <p>
                Removes review flags and private notes. Saved snapshots and the
                active export are kept. Clearing browser/site data can also
                remove this memory.
              </p>
            </div>
            <ActionButton
              variant="danger"
              type="button"
              disabled={disabled || (!records.length && !memory.corrupt)}
              onClick={(event) => {
                trigger.current = event.currentTarget;
                setConfirmation("clear");
              }}
            >
              Clear all Review Memory
            </ActionButton>
          </div>
          {error && <p role="alert">{error}</p>}
          {message && <p role="status">{message}</p>}
          {confirmation && (
            <VaultConfirmation
              returnFocus={trigger}
              title={
                confirmation === "clear"
                  ? "Clear all Review Memory?"
                  : "Import this Review Memory backup?"
              }
              action={
                confirmation === "clear"
                  ? "Delete all Review Memory"
                  : "Confirm Review Memory import"
              }
              strong={confirmation === "clear"}
              danger={confirmation === "clear"}
              errorMessage={reviewMemoryStorageMessage}
              onCancel={() => setConfirmation(null)}
              onConfirm={async () => {
                if (confirmation === "clear") {
                  await memory.remove();
                  setMessage(
                    "All Review Memory cleared. Saved snapshots and the active export were kept.",
                  );
                } else if (backup) {
                  const result = await memory.importMemory(backup);
                  setMessage(
                    `${result.added} Review Memory records imported locally · ${result.skipped} existing local records kept.`,
                  );
                  setBackup(null);
                  if (input.current) input.current.value = "";
                }
              }}
            >
              <p>
                {confirmation === "clear"
                  ? "This permanently removes all Keep, Reviewed, Watch and private notes from this browser, including unreadable records. Export a private backup first if you want to keep them; unreadable records must be cleared individually before a complete backup can be exported."
                  : "Only missing usernames are added. Existing local records and notes always win, regardless of backup timestamp."}{" "}
                Snapshot Vault and your active export will not change.
              </p>
            </VaultConfirmation>
          )}
        </>
      )}
    </section>
  );
}
