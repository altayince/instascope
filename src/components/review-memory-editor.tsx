"use client";
import { useEffect, useId, useRef, useState } from "react";
import { ActionButton } from "./actions";
import { useReviewMemory } from "./review-memory-provider";
import { reviewMemoryStorageMessage } from "@/lib/review-memory-storage";
import "./review-memory.css";

export function ReviewMemoryEditor({
  username,
  onDirtyChange,
}: {
  username: string;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const memory = useReviewMemory();
  if (!memory.ready)
    return (
      <section className="review-memory-editor" aria-label="Review memory">
        <h3>Review memory</h3>
        <p role="status">Reading review memory from this browser…</p>
        {memory.error && (
          <div role="alert">
            <p>{memory.error}</p>
            <ActionButton
              type="button"
              onClick={() => void memory.retry().catch(() => undefined)}
            >
              Retry local storage
            </ActionButton>
          </div>
        )}
      </section>
    );
  return (
    <ReadyMemoryEditor
      key={`${memory.demo ? "demo" : "real"}:${username}`}
      username={username}
      onDirtyChange={onDirtyChange}
    />
  );
}

function ReadyMemoryEditor({
  username,
  onDirtyChange,
}: {
  username: string;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const memory = useReviewMemory();
  const record = memory.records.get(username);
  const [draft, setDraft] = useState<string | null>(null);
  const note = draft ?? record?.note ?? "";
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const cancelClear = useRef<HTMLButtonElement>(null);
  const clearTrigger = useRef<HTMLButtonElement>(null);
  const alive = useRef(true);
  const id = useId();
  const dirty = note !== (record?.note ?? "");
  const disabled = busy || !!memory.error;
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      onDirtyChange(false);
    };
  }, [onDirtyChange]);
  useEffect(() => {
    if (confirmClear) cancelClear.current?.focus({ preventScroll: true });
  }, [confirmClear]);
  async function commit(action: () => Promise<void>, success: string) {
    if (disabled) return;
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      await action();
      if (alive.current) setMessage(success);
    } catch (error) {
      if (alive.current) {
        setFailed(true);
        setMessage(reviewMemoryStorageMessage(error));
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  const saved = memory.demo
    ? "Fictional review memory updated for this demo."
    : "Review memory saved in this browser.";
  return (
    <section className="review-memory-editor" aria-labelledby={`${id}-title`}>
      <div className="review-memory-heading">
        <h3 id={`${id}-title`}>Review memory</h3>
        <span>Your decisions</span>
      </div>
      <p className="review-memory-privacy">
        {memory.demo
          ? "Demo data · Fictional review memory"
          : "Stored only in this browser. These labels and notes are your decisions, separate from export facts."}
      </p>
      <div
        className="review-memory-flags"
        role="group"
        aria-label="Review memory flags"
      >
        {(
          [
            ["keep", "Keep"],
            ["reviewed", "Reviewed"],
            ["watch", "Watch"],
          ] as const
        ).map(([flag, label]) => (
          <button
            type="button"
            key={flag}
            aria-pressed={!!record?.[flag]}
            disabled={disabled}
            onClick={() =>
              void commit(
                () => memory.update(username, { [flag]: !record?.[flag] }),
                saved,
              )
            }
          >
            {label}
          </button>
        ))}
      </div>
      <p className="review-memory-help">
        Keep, Reviewed and Watch can be combined. They do not change Instagram
        or this export.
      </p>
      <div className="review-memory-note">
        <label htmlFor={`${id}-note`}>Private note</label>
        <textarea
          id={`${id}-note`}
          rows={3}
          maxLength={500}
          value={note}
          disabled={disabled}
          onChange={(event) => {
            setDraft(event.target.value);
            setMessage("");
          }}
          placeholder="A short reminder for your future review"
          aria-describedby={`${id}-note-help`}
        />
      </div>
      <p id={`${id}-note-help`} className="review-memory-help">
        {note.length}/500 characters · Notes stay out of share cards, factual
        analysis and selected-account CSV files.
      </p>
      <div className="review-memory-actions">
        <ActionButton
          type="button"
          disabled={disabled || !dirty}
          onClick={() =>
            void commit(() => memory.update(username, { note }), saved)
          }
        >
          {busy ? "Saving…" : "Save note"}
        </ActionButton>
        <ActionButton
          ref={clearTrigger}
          type="button"
          variant="tertiary"
          disabled={busy || !!memory.error || (!record && !memory.corrupt)}
          onClick={() => setConfirmClear(true)}
        >
          Clear account memory
        </ActionButton>
        {dirty && <span className="review-memory-unsaved">Unsaved note</span>}
      </div>
      {confirmClear && (
        <div className="review-memory-confirm" role="alert">
          <strong>Clear this account’s review memory?</strong>
          <p>
            Keep, Reviewed, Watch and the saved note will be removed. Your
            export and saved snapshots stay unchanged.
            {dirty ? " The unsaved note will also be discarded." : ""}
          </p>
          <div className="review-memory-actions">
            <button
              ref={cancelClear}
              className="button secondary"
              type="button"
              disabled={busy}
              onClick={() => {
                setConfirmClear(false);
                clearTrigger.current?.focus({ preventScroll: true });
              }}
            >
              Cancel
            </button>
            <ActionButton
              type="button"
              variant="danger"
              disabled={busy || !!memory.error}
              onClick={() =>
                void commit(
                  async () => {
                    await memory.remove(username);
                    if (alive.current) {
                      setDraft(null);
                      setConfirmClear(false);
                      cancelClear.current
                        ?.closest("dialog")
                        ?.querySelector<HTMLButtonElement>(".drawer-close")
                        ?.focus({ preventScroll: true });
                    }
                  },
                  memory.demo
                    ? "Fictional account memory cleared for this demo."
                    : "Account review memory cleared in this browser.",
                )
              }
            >
              Clear this account’s memory
            </ActionButton>
          </div>
        </div>
      )}
      {busy && <p role="status">Saving review memory…</p>}
      {message && <p role={failed ? "alert" : "status"}>{message}</p>}
      {memory.error && (
        <div className="review-memory-error" role="alert">
          <p>{memory.error}</p>
          <ActionButton
            type="button"
            disabled={busy}
            onClick={() => void memory.retry().catch(() => undefined)}
          >
            Retry local storage
          </ActionButton>
        </div>
      )}
      {memory.warning && <p className="review-memory-help">{memory.warning}</p>}
      {!!memory.corrupt && !record && (
        <p role="status">
          Some saved records are unreadable; no saved decision is inferred for
          those records. New account decisions can still be saved. Editing an
          unreadable record is safely rejected until it is explicitly cleared.
        </p>
      )}
    </section>
  );
}
