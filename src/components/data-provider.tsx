"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { Dataset } from "@/lib/instagram/types";
import { demoSnapshots } from "@/lib/demo";
import {
  deleteSavedSnapshot,
  readSavedSnapshot,
  restoreSavedSnapshot,
  savedComparisonError,
  writeSavedSnapshot,
  type SavedSnapshot,
} from "@/lib/snapshot-storage";

type OlderSource = "manual" | "saved" | "demo" | null;
type State = {
  dataset: Dataset | null;
  older: Dataset | null;
  olderSource: OlderSource;
  currentExportDate: string | null;
  saved: SavedSnapshot | null;
  storageReady: boolean;
  storageError: string;
  setDataset: (v: Dataset) => void;
  setOlder: (v: Dataset | null) => void;
  saveCurrent: (exportDate: string) => string | null;
  chooseSavedAsOlder: (
    currentDate: string,
    sameAccountConfirmed: boolean,
  ) => string | null;
  deleteSaved: () => string | null;
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
  const [saved, setSaved] = useState<SavedSnapshot | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setSaved(readSavedSnapshot(window.localStorage));
      } catch {
        setStorageError("Browser storage is unavailable in this session.");
      } finally {
        setStorageReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function clear() {
    setCurrent(null);
    setPrevious(null);
    setOlderSource(null);
    setCurrentExportDate(null);
  }

  function setDataset(value: Dataset) {
    setCurrent(value);
    setPrevious(null);
    setOlderSource(null);
    setCurrentExportDate(null);
  }

  function setOlder(value: Dataset | null) {
    setPrevious(value);
    setOlderSource(value ? "manual" : null);
    setCurrentExportDate(null);
  }

  function saveCurrent(exportDate: string): string | null {
    if (!dataset) return "Upload an export before saving a snapshot.";
    try {
      const next = writeSavedSnapshot(window.localStorage, dataset, exportDate);
      setSaved(next);
      setStorageError("");
      if (olderSource === "saved") setOlder(null);
      return null;
    } catch (error) {
      return error instanceof Error
        ? error.message
        : "This browser could not save the snapshot.";
    }
  }

  function chooseSavedAsOlder(
    currentDate: string,
    sameAccountConfirmed: boolean,
  ): string | null {
    if (!dataset || !saved)
      return "Upload an export and save an older snapshot first.";
    if (dataset.metadata.demo)
      return "A fictional demo cannot be compared with your saved snapshot.";
    const validationError = savedComparisonError(
      currentDate,
      saved.exportDate,
      sameAccountConfirmed,
    );
    if (validationError) return validationError;
    setPrevious(restoreSavedSnapshot(saved));
    setOlderSource("saved");
    setCurrentExportDate(currentDate);
    return null;
  }

  function deleteSaved(): string | null {
    try {
      deleteSavedSnapshot(window.localStorage);
      setSaved(null);
      setStorageError("");
      if (olderSource === "saved") setOlder(null);
      return null;
    } catch {
      return "This browser could not delete the saved snapshot. Check site storage settings.";
    }
  }

  return (
    <Context.Provider
      value={{
        dataset,
        older,
        olderSource,
        currentExportDate,
        saved,
        storageReady,
        storageError,
        setDataset,
        setOlder,
        saveCurrent,
        chooseSavedAsOlder,
        deleteSaved,
        clear,
        startDemo: () => {
          const demo = demoSnapshots();
          setCurrent(demo.newer);
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
