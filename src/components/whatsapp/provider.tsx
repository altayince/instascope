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
  readWhatsApp,
  WhatsAppImportError,
  type WhatsAppAnalysis,
  type WhatsAppDataset,
  type WhatsAppFormatId,
} from "@/lib/whatsapp";

type WhatsAppState = {
  dataset: WhatsAppDataset | null;
  revision: number;
  analysis: WhatsAppAnalysis | null;
  format: WhatsAppFormatId | "";
  setFormat: (format: WhatsAppFormatId | "") => void;
  busy: boolean;
  error: string;
  importFiles: (files: readonly File[]) => Promise<boolean>;
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
  const [error, setError] = useState("");
  const generation = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      pending.current?.abort();
      pending.current = null;
    };
  }, []);
  const analysis = useMemo(
    () => (dataset ? analyzeWhatsApp(dataset) : null),
    [dataset],
  );

  const importFiles = useCallback(
    async (files: readonly File[]) => {
      if (pending.current) return false;
      if (!format) {
        setError("Choose the date and time format shown in your export first.");
        return false;
      }
      const currentGeneration = ++generation.current;
      const controller = new AbortController();
      pending.current = controller;
      setBusy(true);
      setError("");
      try {
        // Let the reading state paint before local parsing starts.
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
        const result = await readWhatsApp(files, format, controller.signal);
        if (!alive.current || currentGeneration !== generation.current)
          return false;
        setDataset(result);
        setRevision((current) => current + 1);
        return true;
      } catch (cause) {
        if (alive.current && currentGeneration === generation.current) {
          setError(
            cause instanceof WhatsAppImportError
              ? cause.message
              : "This chat could not be read. Export it again without media, then choose its date and time format and try again.",
          );
        }
        return false;
      } finally {
        if (pending.current === controller) pending.current = null;
        if (alive.current && currentGeneration === generation.current)
          setBusy(false);
      }
    },
    [format],
  );

  function clear() {
    generation.current++;
    pending.current?.abort();
    pending.current = null;
    setDataset(null);
    setBusy(false);
    setError("");
  }

  function startDemo() {
    generation.current++;
    pending.current?.abort();
    pending.current = null;
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
        error,
        importFiles,
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
