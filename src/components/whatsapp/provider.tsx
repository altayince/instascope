"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  analyzeWhatsApp,
  createWhatsAppDemo,
  inspectWhatsAppExport,
  readWhatsApp,
  WhatsAppImportError,
  type WhatsAppAnalysis,
  type WhatsAppDataset,
  type WhatsAppFormatId,
  type WhatsAppInspection,
} from "@/lib/whatsapp";

type WhatsAppState = {
  dataset: WhatsAppDataset | null;
  revision: number;
  analysis: WhatsAppAnalysis | null;
  format: WhatsAppFormatId | "";
  setFormat: (format: WhatsAppFormatId | "") => void;
  busy: boolean;
  phase: "detecting" | "parsing" | null;
  inspection: WhatsAppInspection | null;
  error: string;
  importFiles: (files: readonly File[]) => Promise<boolean>;
  confirmImport: () => Promise<boolean>;
  cancelImport: () => void;
  startDemo: () => void;
  clear: () => void;
};

const Context = createContext<WhatsAppState | null>(null);

/** A separate, ephemeral workspace. No archive or result is written to storage. */
export function WhatsAppProvider({ children }: { children: ReactNode }) {
  const [dataset, setDataset] = useState<WhatsAppDataset | null>(null);
  // Each accepted dataset has its own view identity, even when counts match.
  const [revision, setRevision] = useState(0);
  const [format, setFormat] = useState<WhatsAppFormatId | "">("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<WhatsAppState["phase"]>(null);
  const [inspection, setInspection] = useState<WhatsAppInspection | null>(null);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const selectedFiles = useRef<readonly File[] | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    const lifecycleGeneration = generation;
    alive.current = true;
    return () => {
      alive.current = false;
      lifecycleGeneration.current++;
      pending.current?.abort();
      pending.current = null;
      selectedFiles.current = null;
    };
  }, []);
  const analysis = useMemo(
    () => (dataset ? analyzeWhatsApp(dataset) : null),
    [dataset],
  );

  const importFiles = useCallback(async (files: readonly File[]) => {
    const currentGeneration = ++generation.current;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setPhase("detecting");
    setInspection(null);
    selectedFiles.current = null;
    setError("");
    try {
      // Let the reading state paint before local parsing starts.
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      const result = await inspectWhatsAppExport(files, controller.signal);
      if (!alive.current || currentGeneration !== generation.current)
        return false;
      selectedFiles.current = [...files];
      setInspection(result);
      // An ambiguous order always needs a deliberate choice for this file.
      setFormat(result.detection.detectedFormat ?? "");
      return false;
    } catch (cause) {
      if (alive.current && currentGeneration === generation.current) {
        setError(
          cause instanceof WhatsAppImportError
            ? cause.message
            : "This chat could not be inspected. Export it again without media and try again.",
        );
      }
      return false;
    } finally {
      if (pending.current === controller) pending.current = null;
      if (alive.current && currentGeneration === generation.current) {
        setBusy(false);
        setPhase(null);
      }
    }
  }, []);

  const confirmImport = useCallback(async () => {
    if (pending.current) return false;
    if (!selectedFiles.current || !inspection || !format) {
      setError(
        "Choose and confirm the date and time format for this export first.",
      );
      return false;
    }
    if (
      inspection.detection.status === "unsupported" ||
      !inspection.detection.candidateFormats.includes(format)
    ) {
      setError(
        "This format does not match the supported timestamp records. Choose a matching format or export a fresh chat TXT file.",
      );
      return false;
    }
    const files = selectedFiles.current;
    const currentGeneration = ++generation.current;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setPhase("parsing");
    setError("");
    try {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      const result = await readWhatsApp(files, format, controller.signal);
      if (!alive.current || currentGeneration !== generation.current)
        return false;
      setDataset(result);
      setRevision((current) => current + 1);
      selectedFiles.current = null;
      setInspection(null);
      return true;
    } catch (cause) {
      if (alive.current && currentGeneration === generation.current)
        setError(
          cause instanceof WhatsAppImportError
            ? cause.message
            : "This chat could not be read. Check its date and time format, or export it again without media and try again.",
        );
      return false;
    } finally {
      if (pending.current === controller) pending.current = null;
      if (alive.current && currentGeneration === generation.current) {
        setBusy(false);
        setPhase(null);
      }
    }
  }, [inspection, format]);

  function cancelImport() {
    generation.current++;
    pending.current?.abort();
    pending.current = null;
    selectedFiles.current = null;
    setInspection(null);
    setBusy(false);
    setPhase(null);
    setError("");
  }

  function clear() {
    cancelImport();
    setDataset(null);
  }

  function startDemo() {
    cancelImport();
    setDataset(createWhatsAppDemo());
    setRevision((current) => current + 1);
    setBusy(false);
    setError("");
  }

  return (
    <Context.Provider
      value={{
        dataset,
        revision,
        analysis,
        format,
        setFormat: (next) => {
          setFormat(next);
          setError("");
        },
        busy,
        phase,
        inspection,
        error,
        importFiles,
        confirmImport,
        cancelImport,
        startDemo,
        clear,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useWhatsApp() {
  const state = useContext(Context);
  if (!state) throw new Error("Missing WhatsApp provider");
  return state;
}
