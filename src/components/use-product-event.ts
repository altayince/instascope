"use client";
import { useCallback, useEffect, useRef } from "react";
import { track, type ProductEvent } from "@/lib/analytics";

// These guards live only in React memory. A new route entry may be counted;
// StrictMode replay and unrelated renders do not create additional openings.
export function useProductSurface(event: ProductEvent | null, enabled = true) {
  const opened = useRef<ProductEvent | null>(null);
  useEffect(() => {
    if (!enabled || !event || opened.current === event) return;
    opened.current = event;
    track(event);
  }, [event, enabled]);
}

// Watch/Pulse are embedded sections, so mounting alone does not mean they
// were opened. Only the semantic event is sent, never visibility measurements.
export function useVisibleProductSurface(event: ProductEvent) {
  const section = useRef<HTMLElement | null>(null);
  const activeObserver = useRef<IntersectionObserver | null>(null);
  const opened = useRef(false);
  const attach = useCallback((node: HTMLElement | null) => {
    if (section.current) activeObserver.current?.unobserve(section.current);
    section.current = node;
    if (node && !opened.current) activeObserver.current?.observe(node);
  }, []);
  useEffect(() => {
    if (opened.current || !section.current || !window.IntersectionObserver)
      return;
    const observer = new IntersectionObserver((entries) => {
      if (opened.current || !entries.some((entry) => entry.isIntersecting))
        return;
      opened.current = true;
      track(event);
      observer.disconnect();
    });
    activeObserver.current = observer;
    observer.observe(section.current);
    return () => {
      observer.disconnect();
      activeObserver.current = null;
    };
  }, [event]);
  return attach;
}
