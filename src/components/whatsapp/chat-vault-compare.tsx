"use client";

import { useEffect, useRef, useState } from "react";
import { ActionButton } from "@/components/actions";
import type { ChatVaultSnapshot } from "@/lib/whatsapp/chat-vault";
import {
  compareChatVaultSnapshots,
  type ChatVaultComparisonResult,
} from "@/lib/whatsapp/chat-vault-compare";
import {
  chatVaultStorageMessage,
  type ChatVaultStorage,
} from "@/lib/whatsapp/chat-vault-storage";
import { ChatCompareResults } from "./chat-compare-results";
import { chatVaultOptionLabel } from "./chat-vault-labels";

type Selection = {
  first: string;
  second: string;
  confirmed: boolean;
  signature: string;
};
const emptySelection: Selection = {
  first: "",
  second: "",
  confirmed: false,
  signature: "",
};

// Canonical validated aggregates only. No identity/association is persisted.
function pairSignature(
  snapshots: ChatVaultSnapshot[],
  first: string,
  second: string,
) {
  return JSON.stringify([
    snapshots.find((snapshot) => snapshot.id === first) ?? null,
    snapshots.find((snapshot) => snapshot.id === second) ?? null,
  ]);
}

export function ChatVaultCompare({
  snapshots,
  ready,
  storageError,
  storage,
  refresh,
}: {
  snapshots: ChatVaultSnapshot[];
  ready: boolean;
  storageError: string;
  storage: ChatVaultStorage;
  refresh: () => Promise<void>;
}) {
  const [selection, setSelection] = useState(emptySelection);
  const [result, setResult] = useState<ChatVaultComparisonResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const alive = useRef(false);
  const firstControl = useRef<HTMLSelectElement>(null);
  const signature = pairSignature(snapshots, selection.first, selection.second);
  const fresh = signature === selection.signature && ready && !storageError;
  const firstExists = snapshots.some(
    (snapshot) => snapshot.id === selection.first,
  );
  const secondExists = snapshots.some(
    (snapshot) => snapshot.id === selection.second,
  );
  const distinct = selection.first !== selection.second;
  const canCompare =
    fresh && firstExists && secondExists && distinct && selection.confirmed;

  useEffect(() => {
    const lifecycle = generation;
    alive.current = true;
    return () => {
      alive.current = false;
      lifecycle.current++;
    };
  }, []);

  useEffect(() => {
    if (signature === selection.signature && ready && !storageError) return;
    generation.current++;
    // Hide stale output immediately through `fresh`, then clear consent/state.
    const timer = window.setTimeout(() => {
      setBusy(false);
      setSelection((previous) => {
        if (previous.signature === signature && ready && !storageError)
          return previous;
        return { ...previous, confirmed: false, signature };
      });
      setResult(null);
      if (selection.first || selection.second) {
        setError(
          "Selected snapshots changed or became unavailable. Review the pair and confirm again.",
        );
      }
    }, 0);
    return () => window.clearTimeout(timer);
    // Snapshot content/readiness, not object identity, invalidates a pending read.
  }, [
    signature,
    ready,
    storageError,
    selection.signature,
    selection.first,
    selection.second,
  ]);

  function choose(first: string, second: string) {
    generation.current++;
    setSelection({
      first,
      second,
      confirmed: false,
      signature: pairSignature(snapshots, first, second),
    });
    setResult(null);
    setError("");
    setBusy(false);
  }

  async function compare() {
    if (busy) return;
    // Required independently of the disabled UI, including consent.
    if (!canCompare) {
      setError(
        "Choose two different available snapshots and confirm they describe the same conversation.",
      );
      return;
    }
    const request = ++generation.current;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      // One existing readonly transaction resolves both records at action time.
      const current = await storage.list();
      if (!alive.current || request !== generation.current) return;
      const first = current.snapshots.find(
        (item) => item.id === selection.first,
      );
      const second = current.snapshots.find(
        (item) => item.id === selection.second,
      );
      if (
        !first ||
        !second ||
        pairSignature(current.snapshots, selection.first, selection.second) !==
          selection.signature
      ) {
        setSelection({ ...selection, confirmed: false });
        setError(
          "A selected snapshot changed or is no longer available. Review the saved snapshots and select again.",
        );
        await refresh();
        return;
      }
      setResult(compareChatVaultSnapshots(first, second));
    } catch (cause) {
      if (alive.current && request === generation.current) {
        setSelection({ ...selection, confirmed: false });
        setError(chatVaultStorageMessage(cause));
        await refresh();
      }
    } finally {
      if (alive.current && request === generation.current) setBusy(false);
    }
  }

  return (
    <section className="wa-chat-compare" aria-labelledby="wa-compare-entry">
      <div className="wa-panel">
        <span className="wa-eyebrow">TWO SAVED FULL EXPORTS</span>
        <h2 id="wa-compare-entry">Compare saved chat snapshots</h2>
        <p>
          Choose two snapshots you know describe the same conversation.
          InstaScope cannot verify this: no participant identity or conversation
          fingerprint is stored. Selection and comparison stay in memory on this
          device.
        </p>
        {ready && snapshots.length < 2 && (
          <p>Save at least two chat snapshots to compare their aggregates.</p>
        )}
        <div className="wa-filter-controls">
          <label>
            <span>First snapshot</span>
            <select
              ref={firstControl}
              value={firstExists ? selection.first : ""}
              disabled={!ready || busy || snapshots.length < 2}
              onChange={(event) => choose(event.target.value, selection.second)}
            >
              <option value="">Choose a saved snapshot</option>
              {snapshots.map((snapshot, index) => (
                <option key={snapshot.id} value={snapshot.id}>
                  {chatVaultOptionLabel(snapshot, index)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Second snapshot</span>
            <select
              value={secondExists ? selection.second : ""}
              disabled={!ready || busy || snapshots.length < 2}
              onChange={(event) => choose(selection.first, event.target.value)}
            >
              <option value="">Choose a saved snapshot</option>
              {snapshots.map((snapshot, index) => (
                <option key={snapshot.id} value={snapshot.id}>
                  {chatVaultOptionLabel(snapshot, index)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!distinct && firstExists && (
          <p role="status">Choose two different snapshots.</p>
        )}
        <div className="wa-word-choice">
          <label>
            <input
              type="checkbox"
              checked={fresh && selection.confirmed}
              disabled={
                !ready || busy || !firstExists || !secondExists || !distinct
              }
              onChange={(event) => {
                generation.current++;
                setSelection({
                  ...selection,
                  confirmed: event.target.checked,
                  signature,
                });
                setResult(null);
                setError("");
              }}
            />
            I confirm these snapshots describe the same conversation.
          </label>
        </div>
        <ActionButton
          variant="primary"
          disabled={!canCompare || busy}
          onClick={() => void compare()}
        >
          {busy ? "Reading saved snapshots…" : "Compare snapshots"}
        </ActionButton>
        {error && !storageError && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
      </div>
      {fresh &&
        selection.confirmed &&
        result &&
        (result.ok ? (
          <ChatCompareResults
            comparison={result}
            onReset={() => {
              choose("", "");
              firstControl.current?.focus();
            }}
          />
        ) : (
          <div className="notice" role="alert">
            <h3>These snapshots cannot be compared</h3>
            <ul>
              {result.compatibility.reasons.map((reason) => (
                <li key={reason.code}>{reason.message}</li>
              ))}
            </ul>
          </div>
        ))}
    </section>
  );
}
