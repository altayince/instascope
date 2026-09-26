"use client";
import { createContext, useContext, useState } from "react";
import type { Dataset } from "@/lib/instagram/types";
type State = { dataset: Dataset | null; older: Dataset | null; setDataset: (v: Dataset | null) => void; setOlder: (v: Dataset | null) => void; clear: () => void };
const Context = createContext<State | null>(null);
export function DataProvider({ children }: { children: React.ReactNode }) {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [older, setOlder] = useState<Dataset | null>(null);
  return <Context.Provider value={{ dataset, older, setDataset, setOlder, clear: () => { setDataset(null); setOlder(null); } }}>{children}</Context.Provider>;
}
export function useData() { const value = useContext(Context); if (!value) throw new Error("Missing data provider"); return value; }
