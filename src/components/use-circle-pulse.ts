"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { VaultSnapshot } from "@/lib/snapshot-vault";
import {
  circlePulse,
  type CirclePulseResult,
} from "@/lib/analysis/circle-pulse";
import { vaultStorageMessage } from "@/lib/vault-storage";
import { useData } from "./data-provider";
import { useVaultHistoryIndex } from "./use-vault-history";

/** Saved-only observations. An active export is never an input. */
export function useCirclePulse(
  fictional?: readonly VaultSnapshot[],
  { auto = true }: { auto?: boolean } = {},
) {
  const { vault, storageReady, storageError, corruptSnapshots } = useData();
  const {
    signature: historySignature,
    revision,
    load: loadHistory,
  } = useVaultHistoryIndex(fictional);
  const skipped = fictional ? 0 : corruptSnapshots;
  const ready = !!fictional || (storageReady && !storageError);
  const signature = `${historySignature}:skipped=${skipped}:ready=${ready}`;
  const [result, setResult] = useState<{
    signature: string;
    revision: typeof revision;
    model: CirclePulseResult;
  } | null>(null);
  const [failure, setFailure] = useState<{
    signature: string;
    revision: typeof revision;
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState<{
    signature: string;
    revision: typeof revision;
  } | null>(null);
  const active = useRef<{
    signature: string;
    revision: typeof revision;
  } | null>(null);
  useEffect(() => {
    const source = { signature, revision };
    active.current = source;
    const timer = window.setTimeout(
      () =>
        setResult((current) =>
          current?.signature === signature && current.revision === revision
            ? current
            : null,
        ),
      0,
    );
    return () => {
      window.clearTimeout(timer);
      if (active.current === source) active.current = null;
    };
  }, [signature, revision]);
  const count = fictional?.length ?? vault.length;
  const load = useCallback(async () => {
    if (!ready)
      throw new Error(storageError || "Local history is not ready yet.");
    setLoading({ signature, revision });
    setFailure(null);
    try {
      const index = await loadHistory();
      if (
        active.current?.signature !== signature ||
        active.current.revision !== revision
      )
        throw new Error(
          "Saved history changed. Load the current snapshots again.",
        );
      const model = circlePulse({
        ...index,
        corrupt: Math.max(index.corrupt, skipped),
      });
      setResult({ signature, revision, model });
      return model;
    } catch (error) {
      if (
        active.current?.signature === signature &&
        active.current.revision === revision
      )
        setFailure({
          signature,
          revision,
          message: vaultStorageMessage(error),
        });
      throw error;
    } finally {
      setLoading((current) =>
        current?.signature === signature && current.revision === revision
          ? null
          : current,
      );
    }
  }, [loadHistory, revision, ready, signature, skipped, storageError]);
  useEffect(() => {
    if (!auto || !ready || count < 2) return;
    const timer = window.setTimeout(() => void load().catch(() => {}), 0);
    return () => window.clearTimeout(timer);
  }, [auto, ready, count, load]);
  return {
    model:
      ready && result?.signature === signature && result.revision === revision
        ? result.model
        : null,
    error:
      (!fictional && storageError) ||
      (failure?.signature === signature && failure.revision === revision
        ? failure.message
        : ""),
    busy: loading?.signature === signature && loading.revision === revision,
    signature,
    load,
  };
}
