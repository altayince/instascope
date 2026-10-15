"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ActionButton, InsightLink } from "@/components/actions";
import type { WhatsAppDataset } from "@/lib/whatsapp";
import { createChatVaultSnapshot } from "@/lib/whatsapp/chat-vault";
import {
  ChatVaultStorage,
  chatVaultStorageMessage,
} from "@/lib/whatsapp/chat-vault-storage";

export function ChatVaultSaver({
  dataset,
  onSaved,
  showLink = true,
}: {
  dataset: WhatsAppDataset;
  onSaved?: () => Promise<void>;
  showLink?: boolean;
}) {
  const storage = useMemo(() => new ChatVaultStorage(), []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const alive = useRef(false);
  const saving = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const demo = dataset.metadata.source === "demo";
  return (
    <section
      className="wa-panel wa-chat-vault-save"
      aria-label="Save chat snapshot"
    >
      <h2>Keep an aggregate snapshot.</h2>
      <p>
        Save counts and recorded activity from the full loaded export to this
        browser&apos;s Chat Vault. Analyzer filters are not saved. Message text
        and participant identity are never stored.
      </p>
      {demo && (
        <p>
          Fictional demo snapshots are not saved. Open your own export to save a
          snapshot.
        </p>
      )}
      <div className="vault-actions">
        <ActionButton
          variant="primary"
          disabled={busy || demo}
          onClick={async () => {
            if (saving.current || demo) return;
            saving.current = true;
            setBusy(true);
            setMessage("");
            setError("");
            try {
              await new Promise<void>((resolve) =>
                window.setTimeout(resolve, 0),
              );
              const snapshot = createChatVaultSnapshot(dataset);
              await storage.save(snapshot);
              if (alive.current) {
                setMessage(
                  "Saved to Chat Vault on this browser. The raw chat remains in memory only.",
                );
                await onSaved?.();
              }
            } catch (cause) {
              if (alive.current) setError(chatVaultStorageMessage(cause));
            } finally {
              saving.current = false;
              if (alive.current) setBusy(false);
            }
          }}
        >
          {busy ? "Saving aggregate snapshot…" : "Save to Chat Vault"}
        </ActionButton>
        {showLink && (
          <InsightLink href="/whatsapp/chat-vault/">
            Open Chat Vault
          </InsightLink>
        )}
      </div>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
