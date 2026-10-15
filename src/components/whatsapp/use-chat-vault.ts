"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatVaultSnapshot } from "@/lib/whatsapp/chat-vault";
import {
  ChatVaultStorage,
  chatVaultStorageMessage,
} from "@/lib/whatsapp/chat-vault-storage";

/** Local Vault state is separate from the loaded chat and its view filters. */
export function useChatVault() {
  const storage = useMemo(() => new ChatVaultStorage(), []);
  const [state, setState] = useState({
    snapshots: [] as ChatVaultSnapshot[],
    corrupt: 0,
    ready: false,
    error: "",
  });
  const alive = useRef(false);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    try {
      const result = await storage.list();
      if (alive.current && request === generation.current)
        setState({ ...result, ready: true, error: "" });
    } catch (cause) {
      if (alive.current && request === generation.current)
        setState({
          snapshots: [],
          corrupt: 0,
          ready: false,
          error: chatVaultStorageMessage(cause),
        });
    }
  }, [storage]);
  useEffect(() => {
    const lifecycleGeneration = generation;
    alive.current = true;
    const timer = window.setTimeout(() => void refresh(), 0);
    const focused = () => void refresh();
    window.addEventListener("focus", focused);
    return () => {
      alive.current = false;
      lifecycleGeneration.current++;
      window.clearTimeout(timer);
      window.removeEventListener("focus", focused);
    };
  }, [refresh]);
  return { ...state, storage, refresh };
}
