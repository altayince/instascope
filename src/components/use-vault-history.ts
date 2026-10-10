"use client";
import { useCallback, useRef } from "react";
import { useData } from "./data-provider";
import {
  relationshipHistoryIndex,
  type RelationshipHistoryIndex,
} from "@/lib/analysis/relationship-history";
import type { VaultSnapshot } from "@/lib/snapshot-vault";
export function useVaultHistoryIndex(fictional?: readonly VaultSnapshot[]) {
  const { vault, readVaultHistory } = useData();
  const signature = `${fictional ? "demo" : "real"}:${(fictional ?? vault).map((s) => `${s.id}:${s.createdAt}:${s.exportDate}`).join("|")}`;
  const cache = useRef<{
    signature: string;
    promise: Promise<RelationshipHistoryIndex>;
  } | null>(null);
  const load = useCallback(async () => {
    if (cache.current?.signature === signature) return cache.current.promise;
    const promise = fictional
      ? Promise.resolve(relationshipHistoryIndex(fictional))
      : readVaultHistory().then(relationshipHistoryIndex);
    cache.current = { signature, promise };
    try {
      return await promise;
    } catch (error) {
      if (cache.current?.promise === promise) cache.current = null;
      throw error;
    }
  }, [fictional, readVaultHistory, signature]);
  return { signature, load };
}
