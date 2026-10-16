"use client";

import { useEffect, useRef, useState } from "react";
import { ActionButton, ActionLink } from "@/components/actions";
import {
  BackupFilePicker,
  type BackupFilePickerHandle,
} from "@/components/backup-file-picker";
import { VaultConfirmation } from "@/components/vault-confirmation";
import { download } from "@/lib/download";
import {
  ChatVaultValidationError,
  MAX_CHAT_VAULT_BACKUP_BYTES,
  parseChatVaultBackup,
  serializeChatVaultBackup,
  type ChatVaultBackup,
  type ChatVaultSnapshot,
} from "@/lib/whatsapp/chat-vault";
import { chatVaultStorageMessage } from "@/lib/whatsapp/chat-vault-storage";
import { whatsappNumber } from "@/lib/whatsapp/stories";
import { useWhatsApp } from "./provider";
import { ChatVaultSaver } from "./chat-vault-save";
import { useChatVault } from "./use-chat-vault";
import { ChatVaultCompare } from "./chat-vault-compare";
import { chatVaultCoverageLabel as coverageLabel } from "./chat-vault-labels";

export function WhatsAppChatVault() {
  const { dataset, revision } = useWhatsApp();
  const {
    snapshots,
    corrupt,
    ready,
    error: storageError,
    storage,
    refresh,
  } = useChatVault();
  const [operation, setOperation] = useState<"checking" | "exporting" | null>(
    null,
  );
  const busy = operation !== null;
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [deletion, setDeletion] = useState<
    ChatVaultSnapshot | "unreadable" | null
  >(null);
  const [pendingImport, setPendingImport] = useState<{
    backup: ChatVaultBackup;
    preview: { added: number; skipped: number };
  } | null>(null);
  const picker = useRef<BackupFilePickerHandle>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const alive = useRef(false);
  const fileGeneration = useRef(0);
  useEffect(() => {
    const lifecycleGeneration = fileGeneration;
    alive.current = true;
    return () => {
      alive.current = false;
      lifecycleGeneration.current++;
    };
  }, []);

  async function selectBackup(file: File | null) {
    const generation = ++fileGeneration.current;
    setPendingImport(null);
    setError("");
    if (!file) return;
    setOperation("checking");
    setMessage("");
    try {
      if (file.size > MAX_CHAT_VAULT_BACKUP_BYTES)
        throw new ChatVaultValidationError(
          "Choose a Chat Vault backup no larger than 2 MiB. Nothing was imported.",
        );
      const backup = parseChatVaultBackup(await file.text());
      const preview = await storage.preview(backup);
      if (alive.current && generation === fileGeneration.current)
        setPendingImport({ backup, preview });
    } catch (cause) {
      if (alive.current && generation === fileGeneration.current)
        setError(chatVaultStorageMessage(cause));
      picker.current?.reset();
    } finally {
      if (alive.current && generation === fileGeneration.current)
        setOperation(null);
    }
  }

  return (
    <main
      id="main"
      tabIndex={-1}
      className="wa-workspace"
      data-whatsapp-mode="vault"
    >
      <section className="wa-page-heading">
        <span className="wa-eyebrow">WHATSAPP / LOCAL SNAPSHOTS</span>
        <h1>Chat Vault</h1>
        <p>Keep an anonymous aggregate snapshot, without keeping the chat.</p>
      </section>
      <section className="wa-panel" aria-labelledby="chat-vault-privacy">
        <h2 id="chat-vault-privacy">On this browser and device only.</h2>
        <p>
          Saves contain aggregate analysis only. Message text is not stored.
          Participant identity is not stored. Phone numbers, URLs and raw
          exports are not stored. There is no cloud sync or automatic save.
          Clearing browser/site data may remove this Vault; backup is manual and
          local.
        </p>
        <p>
          Every snapshot describes the full supplied export, not complete chat
          history. Recorded dates and rhythms have no supplied timezone.
          Snapshots are not automatically matched to a conversation. A snapshot
          cannot reopen the raw chat. Deliberately select two saved snapshots
          below to compare their full-export aggregates locally.
        </p>
      </section>

      {dataset ? (
        <ChatVaultSaver
          key={revision}
          dataset={dataset}
          onSaved={refresh}
          showLink={false}
        />
      ) : (
        <div className="wa-panel wa-chat-vault-save">
          <p>
            Open a chat export in Chat Analyzer to save its aggregate snapshot.
          </p>
          <ActionLink href="/whatsapp/">Open a chat export</ActionLink>
        </div>
      )}
      {storageError && (
        <div className="notice" role="alert">
          <p>
            {storageError} Your current chat is still available in the other
            tools.
          </p>
          <ActionButton onClick={() => void refresh()}>
            Retry local storage
          </ActionButton>
        </div>
      )}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {corrupt > 0 && (
        <div className="notice" role="status">
          <p>
            {whatsappNumber(corrupt)} unreadable{" "}
            {corrupt === 1 ? "entry is" : "entries are"} kept locally. Valid
            snapshots are still available. A complete backup is blocked until
            unreadable entries are removed; nothing is deleted automatically.
          </p>
          <ActionButton
            variant="danger"
            disabled={busy}
            onClick={(event) => {
              trigger.current = event.currentTarget;
              setDeletion("unreadable");
            }}
          >
            Remove unreadable entries
          </ActionButton>
        </div>
      )}

      <ChatVaultCompare
        snapshots={snapshots}
        ready={ready}
        storageError={storageError}
        storage={storage}
        refresh={refresh}
      />

      <section className="vault-list" aria-labelledby="chat-vault-list">
        <h2 id="chat-vault-list">Saved chat snapshots</h2>
        {!ready && !storageError && (
          <p role="status">Opening local Chat Vault…</p>
        )}
        {ready && snapshots.length === 0 && <p>No saved chat snapshots yet</p>}
        {ready && snapshots.length > 0 && (
          <>
            <p>
              {whatsappNumber(snapshots.length)} saved{" "}
              {snapshots.length === 1 ? "snapshot" : "snapshots"}. Up to 100
              entries are kept; none are replaced automatically.
            </p>
            <ul>
              {snapshots.map((snapshot) => (
                <li key={snapshot.id}>
                  <article
                    className="vault-row"
                    aria-label="Saved chat snapshot"
                  >
                    <div>
                      <h3>Saved chat snapshot</h3>
                      <p>{coverageLabel(snapshot)}</p>
                      <p className="vault-row-meta">
                        {whatsappNumber(snapshot.totals.messages)} messages ·{" "}
                        {whatsappNumber(snapshot.totals.participants)}{" "}
                        participant labels ·{" "}
                        {whatsappNumber(snapshot.totals.activeDays)} active
                        dates
                      </p>
                      <small>
                        Saved{" "}
                        <time
                          dateTime={new Date(snapshot.createdAt).toISOString()}
                        >
                          {new Date(snapshot.createdAt).toLocaleString("en-GB")}
                        </time>
                        {" · "}
                        {snapshot.coverage.sourceSupport === "supported"
                          ? "Supported source structure"
                          : "Partially supported source structure"}
                      </small>
                    </div>
                    <ActionButton
                      variant="danger"
                      disabled={busy}
                      onClick={(event) => {
                        trigger.current = event.currentTarget;
                        setDeletion(snapshot);
                      }}
                    >
                      Delete snapshot
                    </ActionButton>
                  </article>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="vault-backup" aria-labelledby="chat-vault-backup">
        <h2 id="chat-vault-backup">A manual local backup.</h2>
        <p>
          JSON backups contain the same anonymous aggregates, not chat text or
          participant identity. These counts and dates can still be personal;
          keep the downloaded file private. Import is limited to 100 snapshots
          and 2 MiB. Existing snapshot IDs are kept; matching dates or counts do
          not establish the same conversation.
        </p>
        <div className="vault-actions">
          <ActionButton
            disabled={!ready || busy || snapshots.length === 0 || corrupt > 0}
            onClick={async () => {
              setOperation("exporting");
              setMessage("");
              setError("");
              try {
                const json = serializeChatVaultBackup(await storage.backup());
                download(
                  new Blob([json], { type: "application/json" }),
                  "whatsapp-chat-vault-v1.json",
                );
                if (alive.current)
                  setMessage(
                    "Chat Vault backup downloaded locally. No data was uploaded.",
                  );
              } catch (cause) {
                if (alive.current) setError(chatVaultStorageMessage(cause));
              } finally {
                if (alive.current) setOperation(null);
              }
            }}
          >
            Export Chat Vault backup
          </ActionButton>
        </div>
        <BackupFilePicker
          ref={picker}
          label="Import Chat Vault backup"
          disabled={!ready || busy}
          onSelect={selectBackup}
        />
        <p>
          Validation and a preview come first. Nothing is imported until you
          confirm.
        </p>
        {busy && (
          <p role="status">
            {operation === "checking"
              ? "Checking the local backup. Nothing is imported yet."
              : "Preparing your local backup download."}
          </p>
        )}
      </section>

      {pendingImport && (
        <VaultConfirmation
          title="Import Chat Vault backup?"
          action="Confirm import"
          errorMessage={chatVaultStorageMessage}
          onCancel={() => {
            setPendingImport(null);
            picker.current?.reset();
          }}
          onConfirm={async () => {
            const result = await storage.merge(pendingImport.backup);
            await refresh();
            if (alive.current)
              setMessage(
                `Imported ${result.added} aggregate snapshots. Kept ${result.skipped} existing snapshots.`,
              );
          }}
        >
          <p>
            {pendingImport.backup.snapshots.length} incoming snapshots:{" "}
            {pendingImport.preview.added} new, {pendingImport.preview.skipped}{" "}
            existing IDs kept.
          </p>
          <p>
            This preview has not saved anything. Confirmation merges locally in
            one transaction and rechecks existing IDs. No existing snapshot is
            overwritten.
          </p>
        </VaultConfirmation>
      )}
      {deletion && (
        <VaultConfirmation
          title={
            deletion === "unreadable"
              ? "Remove unreadable entries?"
              : "Delete this chat snapshot?"
          }
          action={
            deletion === "unreadable" ? "Remove entries" : "Delete snapshot"
          }
          danger
          returnFocus={trigger}
          errorMessage={chatVaultStorageMessage}
          onCancel={() => setDeletion(null)}
          onConfirm={async () => {
            if (deletion === "unreadable") await storage.deleteUnreadable();
            else await storage.delete(deletion.id);
            await refresh();
            if (alive.current)
              setMessage(
                "Local deletion completed. Your loaded chat and other saved snapshots are unchanged.",
              );
          }}
        >
          <p>
            {deletion === "unreadable"
              ? "Remove only entries that cannot be read under the supported Chat Vault schema. Valid snapshots are kept."
              : `Remove this aggregate snapshot covering ${coverageLabel(deletion)} from this browser.`}{" "}
            This cannot be undone. Your loaded chat and Instagram Snapshot Vault
            are not deleted.
          </p>
        </VaultConfirmation>
      )}
    </main>
  );
}
