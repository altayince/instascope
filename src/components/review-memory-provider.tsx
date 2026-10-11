"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useData } from "./data-provider";
import { demoReviewMemory } from "@/lib/demo-review-memory";
import { normalizeUsername } from "@/lib/instagram/normalize";
import {
  serializeReviewMemoryBackup,
  updateReviewMemoryRecord,
  type ReviewMemoryBackup,
  type ReviewMemoryPatch,
  type ReviewMemoryRecord,
} from "@/lib/review-memory";
import {
  ReviewMemoryStorage,
  ReviewMemoryStorageError,
  reviewMemoryStorageMessage,
} from "@/lib/review-memory-storage";

type Cache = {
  records: ReadonlyMap<string, ReviewMemoryRecord>;
  ready: boolean;
  error: string;
  corrupt: number;
};
type Memory = Cache & {
  demo: boolean;
  warning: string;
  update: (username: string, patch: ReviewMemoryPatch) => Promise<void>;
  remove: (username?: string) => Promise<void>;
  retry: () => Promise<void>;
  exportMemory: () => Promise<string>;
  importMemory: (
    backup: ReviewMemoryBackup,
  ) => Promise<{ added: number; skipped: number }>;
};
const Context = createContext<Memory | null>(null);
const index = (records: readonly ReviewMemoryRecord[]) =>
  new Map(records.map((record) => [record.username, record]));

// Independent domain: clearing/replacing exports or snapshots never deletes it.
// One cache is shared by every list; account rows never access IndexedDB.
export function ReviewMemoryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { dataset } = useData();
  const demo = !!dataset?.metadata.demo;
  const [store] = useState(() => new ReviewMemoryStorage());
  const [real, setReal] = useState<Cache>({
    records: new Map(),
    ready: false,
    error: "",
    corrupt: 0,
  });
  const [fictional, setFictional] = useState(() => index(demoReviewMemory()));
  const readVersion = useRef(0);
  const invalidateRead = useCallback(() => {
    readVersion.current++;
  }, []);
  const reload = useCallback(async () => {
    const version = ++readVersion.current;
    try {
      const result = await store.list();
      if (version === readVersion.current)
        setReal({
          records: index(result.records),
          ready: true,
          error: "",
          corrupt: result.corrupt,
        });
    } catch (error) {
      if (version === readVersion.current)
        setReal((previous) => ({
          ...previous,
          ready: true,
          error: reviewMemoryStorageMessage(error),
        }));
    }
  }, [store]);
  useEffect(() => {
    if (demo) return;
    const timer = window.setTimeout(() => void reload(), 0);
    const refresh = () => void reload();
    window.addEventListener("focus", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      invalidateRead();
    };
  }, [demo, reload, invalidateRead]);

  function requireRealStorage() {
    if (demo)
      throw new ReviewMemoryStorageError(
        "Fictional review memory cannot be backed up or imported into real storage.",
      );
    if (!real.ready || real.error)
      throw new ReviewMemoryStorageError(
        real.error ||
          "Review Memory is still opening. Please try again shortly.",
      );
  }
  async function update(username: string, patch: ReviewMemoryPatch) {
    if (demo) {
      const normalized = normalizeUsername(username);
      if (!normalized)
        throw new ReviewMemoryStorageError("Enter a valid account username.");
      // Validate before the React updater so callers receive a rejected promise.
      updateReviewMemoryRecord(
        fictional.get(normalized) ?? null,
        normalized,
        patch,
      );
      setFictional((previous) => {
        const record = updateReviewMemoryRecord(
          previous.get(normalized) ?? null,
          normalized,
          patch,
        );
        const next = new Map(previous);
        next.set(record.username, record);
        return next;
      });
      return;
    }
    requireRealStorage();
    const record = await store.update(username, patch);
    readVersion.current++;
    setReal((previous) => {
      const records = new Map(previous.records);
      records.set(record.username, record);
      return { ...previous, records };
    });
  }
  async function remove(username?: string) {
    if (demo) {
      const normalized =
        username === undefined ? undefined : normalizeUsername(username);
      if (normalized === null)
        throw new ReviewMemoryStorageError("Enter a valid account username.");
      setFictional((previous) => {
        const next = new Map(previous);
        if (normalized) next.delete(normalized);
        else next.clear();
        return next;
      });
      return;
    }
    requireRealStorage();
    await store.delete(username);
    // Deletion is already committed; don't leave a stale visible decision if
    // the subsequent refresh encounters a temporary storage failure.
    readVersion.current++;
    setReal((previous) => {
      const records = new Map(previous.records);
      if (username !== undefined) records.delete(normalizeUsername(username)!);
      else records.clear();
      return {
        ...previous,
        records,
        corrupt: username === undefined ? 0 : previous.corrupt,
      };
    });
    await reload();
  }
  return (
    <Context.Provider
      value={{
        ...(demo
          ? { records: fictional, ready: true, error: "", corrupt: 0 }
          : real),
        demo,
        warning:
          !demo && real.corrupt
            ? `${real.corrupt} unreadable Review Memory record${real.corrupt === 1 ? " was" : "s were"} skipped. They were not deleted or treated as review decisions. Clear affected records explicitly before restoring a private backup.`
            : "",
        update,
        remove,
        retry: reload,
        exportMemory: async () => {
          requireRealStorage();
          return serializeReviewMemoryBackup(await store.backup());
        },
        importMemory: async (backup) => {
          requireRealStorage();
          const result = await store.merge(backup);
          await reload();
          return result;
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useReviewMemory() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing Review Memory provider");
  return value;
}
