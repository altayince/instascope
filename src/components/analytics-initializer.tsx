"use client";

import { useEffect } from "react";
import { observeDocumentEntry } from "@/lib/analytics";

export function AnalyticsInitializer() {
  useEffect(() => {
    observeDocumentEntry();
  }, []);
  return null;
}
