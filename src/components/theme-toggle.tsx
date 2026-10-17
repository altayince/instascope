"use client";

import { useSyncExternalStore } from "react";
import {
  normalizeTheme,
  THEME_STORAGE_KEY,
  type Theme,
} from "@/lib/appearance";
import { useBrowserReady } from "./use-browser-ready";

const themeEvent = "instascope:appearance";
const serverTheme = (): Theme => "light";
const currentTheme = () =>
  normalizeTheme(document.documentElement.getAttribute("data-theme"));

function subscribe(listener: () => void) {
  const stored = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
    document.documentElement.setAttribute(
      "data-theme",
      normalizeTheme(event.newValue),
    );
    listener();
  };
  window.addEventListener(themeEvent, listener);
  window.addEventListener("storage", stored);
  return () => {
    window.removeEventListener(themeEvent, listener);
    window.removeEventListener("storage", stored);
  };
}

function selectTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The selection still works for this document when storage is blocked.
  }
  window.dispatchEvent(new Event(themeEvent));
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, currentTheme, serverTheme);
  const ready = useBrowserReady();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-label="Dark mode"
      aria-checked={dark}
      title={`Current theme: ${dark ? "Dark" : "Light"}. Switch to ${dark ? "Light" : "Dark"} mode`}
      className="theme-toggle"
      disabled={!ready}
      onClick={() => selectTheme(dark ? "light" : "dark")}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        aria-hidden="true"
        focusable="false"
      >
        {dark ? (
          <path d="M20 15.6A8.5 8.5 0 0 1 8.4 4a8.5 8.5 0 1 0 11.6 11.6Z" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
          </>
        )}
      </svg>
      <span>{dark ? "Dark" : "Light"}</span>
    </button>
  );
}
