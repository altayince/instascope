"use client";
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { vaultStorageMessage } from "@/lib/vault-storage";

export function VaultConfirmation({
  title,
  children,
  action,
  strong = false,
  returnFocus,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: React.ReactNode;
  action: string;
  strong?: boolean;
  returnFocus?: RefObject<HTMLElement | null>;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const element = dialog.current!;
    const previous = returnFocus?.current ?? document.activeElement;
    element.showModal();
    return () => {
      element.close();
      const target =
        previous instanceof HTMLElement &&
        previous.isConnected &&
        !previous.matches(":disabled")
          ? previous
          : document.getElementById("main");
      target?.focus({ preventScroll: true });
    };
  }, [returnFocus]);
  return (
    <dialog
      ref={dialog}
      className="vault-dialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      aria-busy={busy}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <h2 id={`${id}-title`}>{title}</h2>
      <div id={`${id}-description`}>{children}</div>
      {strong && (
        <label>
          Type DELETE to confirm
          <input
            value={word}
            onChange={(event) => setWord(event.target.value)}
            autoComplete="off"
            disabled={busy}
          />
        </label>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="vault-actions">
        <button type="button" autoFocus onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || (strong && word !== "DELETE")}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await onConfirm();
              onCancel();
            } catch (error) {
              setError(vaultStorageMessage(error));
              setBusy(false);
            }
          }}
        >
          {busy ? "Working locally…" : action}
        </button>
      </div>
    </dialog>
  );
}
