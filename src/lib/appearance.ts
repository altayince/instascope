/** Appearance is a local preference, independent of platform and product data. */
export const THEME_STORAGE_KEY = "instascope-theme";
export type Theme = "light" | "dark";

export function normalizeTheme(value: unknown): Theme {
  return value === "dark" ? "dark" : "light";
}

// Runs synchronously in <head>, before React or the first body paint. The
// current static-export CSP already permits Next's inline initialization.
// Only an allowlisted appearance value can become a root attribute.
export const THEME_INIT_SCRIPT = `(()=>{let theme="light";try{if(localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})==="dark")theme="dark"}catch{}document.documentElement.setAttribute("data-theme",theme)})()`;
