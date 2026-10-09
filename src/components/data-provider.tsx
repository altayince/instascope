"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Dataset } from "@/lib/instagram/types";
import { demoSnapshots } from "@/lib/demo";
import {
  restoreSavedSnapshot,
  savedComparisonError,
} from "@/lib/snapshot-storage";
import {
  createVaultSnapshot,
  serializeVaultBackup,
  type VaultBackup,
  type VaultSnapshot,
  type VaultSummary,
} from "@/lib/snapshot-vault";
import {
  SnapshotVaultStorage,
  VaultStorageError,
  vaultStorageMessage,
} from "@/lib/vault-storage";

type OlderSource = "manual" | "saved" | "demo" | null;
type State = {
  dataset: Dataset | null;
  older: Dataset | null;
  olderSource: OlderSource;
  currentExportDate: string | null;
  saved: VaultSummary | null;
  vault: VaultSummary[];
  corruptSnapshots: number;
  storageReady: boolean;
  storageError: string;
  storageWarning: string;
  refreshVault: () => Promise<void>;
  retryVault: () => Promise<void>;
  setDataset: (v: Dataset) => void;
  setOlder: (v: Dataset | null) => void;
  saveCurrent: (
    date: string,
    replace?: Pick<VaultSummary, "id" | "createdAt">,
  ) => Promise<VaultSnapshot>;
  chooseSavedAsOlder: (
    date: string,
    confirmed: boolean,
    id: string,
    revision: number,
  ) => Promise<string | null>;
  readSnapshot: (id: string) => Promise<VaultSnapshot>;
  readVaultHistory: () => Promise<VaultSnapshot[]>;
  removeSnapshot: (id?: string) => Promise<void>;
  exportVault: () => Promise<string>;
  importVault: (
    backup: VaultBackup,
  ) => Promise<{ added: number; skipped: number }>;
  clear: () => void;
  startDemo: () => void;
};
const Context = createContext<State | null>(null);
export function DataProvider({ children }: { children: React.ReactNode }) {
  const [dataset, setCurrent] = useState<Dataset | null>(null);
  const [older, setPrevious] = useState<Dataset | null>(null);
  const [olderSource, setOlderSource] = useState<OlderSource>(null);
  const [currentExportDate, setCurrentExportDate] = useState<string | null>(
    null,
  );
  const [vault, setVault] = useState<VaultSummary[]>([]);
  const [corruptSnapshots, setCorrupt] = useState(0);
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [storageWarning, setWarning] = useState("");
  const [store] = useState(() => new SnapshotVaultStorage());
  const selected = useRef<Pick<VaultSummary, "id" | "createdAt"> | null>(null);
  const readVaultHistory = useCallback(() => store.history(), [store]);
  const current = useRef(dataset);

  const refreshVault = useCallback(async () => {
    const result = await store.list();
    setVault(result.snapshots);
    setCorrupt(result.corrupt);
    setStorageError("");
    const previous = selected.current;
    if (
      previous &&
      !result.snapshots.some(
        (snapshot) =>
          snapshot.id === previous.id &&
          snapshot.createdAt === previous.createdAt,
      )
    ) {
      selected.current = null;
      setPrevious(null);
      setOlderSource(null);
      setCurrentExportDate(null);
    }
  }, [store]);
  const retryVault = useCallback(async () => {
    // A failed migration must not hide otherwise readable history or deletion.
    try {
      setWarning(await store.initialize());
    } catch (error) {
      setWarning(
        `The older saved copy could not be migrated; it was not removed. ${vaultStorageMessage(error)}`,
      );
    }
    await refreshVault();
  }, [store, refreshVault]);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        let warning = "";
        try {
          warning = await store.initialize();
        } catch (error) {
          warning = `The older saved copy could not be migrated; it was not removed. ${vaultStorageMessage(error)}`;
        }
        const result = await store.list();
        if (active) {
          setWarning(warning);
          setVault(result.snapshots);
          setCorrupt(result.corrupt);
        }
      } catch (error) {
        if (active) setStorageError(vaultStorageMessage(error));
      } finally {
        if (active) setStorageReady(true);
      }
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [store]);
  useEffect(() => {
    if (!storageReady) return;
    const refresh = () => {
      void refreshVault().catch((error) =>
        setStorageError(vaultStorageMessage(error)),
      );
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [storageReady, refreshVault]);

  function setOlder(value: Dataset | null) {
    selected.current = null;
    setPrevious(value);
    setOlderSource(value ? "manual" : null);
    setCurrentExportDate(null);
  }
  function clear() {
    current.current = null;
    setCurrent(null);
    setOlder(null);
  }
  function setDataset(value: Dataset) {
    current.current = value;
    setCurrent(value);
    setOlder(null);
  }
  async function saveCurrent(
    date: string,
    replace?: Pick<VaultSummary, "id" | "createdAt">,
  ) {
    if (!dataset)
      throw new VaultStorageError("Upload an export before saving a snapshot.");
    let candidate: VaultSnapshot;
    try {
      candidate = createVaultSnapshot(dataset, date);
    } catch (error) {
      throw new VaultStorageError(
        error instanceof Error ? error.message : "This export cannot be saved.",
      );
    }
    const saved = await store.save(candidate, replace);
    await refreshVault();
    return saved;
  }
  async function chooseSavedAsOlder(
    date: string,
    confirmed: boolean,
    id: string,
    revision: number,
  ): Promise<string | null> {
    const source = current.current;
    if (!source)
      return "Upload an export before comparing with a saved snapshot.";
    if (source.metadata.demo)
      return "A fictional demo cannot be compared with your saved snapshot.";
    try {
      const saved = await store.get(id);
      if (saved.createdAt !== revision) {
        await refreshVault();
        return "The saved snapshot changed. Choose it and confirm the same account again.";
      }
      const error = savedComparisonError(date, saved.exportDate, confirmed);
      if (error) return error;
      if (source !== current.current)
        return "The active export changed. Confirm the comparison again.";
      selected.current = { id: saved.id, createdAt: saved.createdAt };
      setPrevious(restoreSavedSnapshot(saved));
      setOlderSource("saved");
      setCurrentExportDate(date);
      return null;
    } catch (error) {
      return vaultStorageMessage(error);
    }
  }
  async function removeSnapshot(id?: string) {
    const warning = await store.delete(id);
    await refreshVault();
    setWarning(warning);
  }
  async function importVault(backup: VaultBackup) {
    const result = await store.merge(backup);
    await refreshVault();
    return result;
  }
  return (
    <Context.Provider
      value={{
        dataset,
        older,
        olderSource,
        currentExportDate,
        saved: vault[0] ?? null,
        vault,
        corruptSnapshots,
        storageReady,
        storageError,
        storageWarning,
        refreshVault,
        retryVault,
        setDataset,
        setOlder,
        saveCurrent,
        chooseSavedAsOlder,
        readSnapshot: (id) => store.get(id),
        readVaultHistory,
        removeSnapshot,
        exportVault: async () => {
          const snapshots = await store.backup();
          try {
            return serializeVaultBackup(snapshots);
          } catch (error) {
            throw new VaultStorageError(
              error instanceof Error
                ? error.message
                : "This Vault backup could not be exported.",
            );
          }
        },
        importVault,
        clear,
        startDemo: () => {
          const demo = demoSnapshots();
          current.current = demo.newer;
          setCurrent(demo.newer);
          selected.current = null;
          setPrevious(demo.older);
          setOlderSource("demo");
          setCurrentExportDate(null);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useData() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing data provider");
  return value;
}
