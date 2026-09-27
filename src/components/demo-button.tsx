"use client";
import { useData } from "./data-provider";
import { useBrowserReady } from "./use-browser-ready";
export function DemoButton() {
  const { startDemo } = useData();
  const ready = useBrowserReady();
  return (
    <button
      className="button secondary"
      disabled={!ready}
      onClick={() => {
        startDemo();
        requestAnimationFrame(() =>
          document
            .getElementById("tool")
            ?.scrollIntoView({
              behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
                ? "instant"
                : "smooth",
            }),
        );
      }}
    >
      Try the demo
    </button>
  );
}
