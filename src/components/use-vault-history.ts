"use client";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useData } from "./data-provider";
import {
  relationshipHistoryIndex,
  type RelationshipHistoryIndex,
} from "@/lib/analysis/relationship-history";
import type { VaultSnapshot } from "@/lib/snapshot-vault";
export function useVaultHistoryIndex(fictional?: readonly VaultSnapshot[]) {
  const {
    vault,
    readVaultHistory,
    storageReady,
    storageError,
    corruptSnapshots,
  } = useData();
  const status = fictional
    ? "fictional"
    : `${storageReady}:${!!storageError}:${corruptSnapshots}`;
  const signature = `${fictional ? "demo" : "real"}:${status}:${(fictional ?? vault).map((s) => `${s.id}:${s.createdAt}:${s.exportDate}`).join("|")}`;
  // A restored backup may reuse metadata after an intervening deletion. Each
  // observed signature transition has a new token, even if text repeats later.
  const revision = useMemo(() => ({ signature }), [signature]);
  const cache = useRef<{
    revision: typeof revision;
    promise: Promise<RelationshipHistoryIndex>;
  } | null>(null);
  useEffect(
    () => () => {
      if (cache.current?.revision === revision) cache.current = null;
    },
    [revision],
  );
  const load = useCallback(async () => {
    if (cache.current?.revision === revision) return cache.current.promise;
    const promise = fictional
      ? Promise.resolve(relationshipHistoryIndex(fictional))
      : readVaultHistory().then(relationshipHistoryIndex);
    cache.current = { revision, promise };
    try {
      return await promise;
    } catch (error) {
      if (cache.current?.promise === promise) cache.current = null;
      throw error;
    }
  }, [fictional, readVaultHistory, revision]);
  return { signature, revision, load };
}
