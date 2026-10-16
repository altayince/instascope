"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  getAvailablePlatforms,
  type PlatformDefinition,
  type PlatformMarkId,
} from "@/lib/platforms";

const platformMarks: Record<PlatformMarkId, ReactNode> = {
  orbit: "◎",
  chat: (
    <svg viewBox="0 0 32 32" fill="none" focusable="false">
      <path
        d="M27 14.5a11 11 0 0 1-11 11 12 12 0 0 1-4.5-.9L5 27l1.9-6.2a11 11 0 1 1 20.1-6.3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M11 12h10M11 17h7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  ),
};

export function PlatformMark({
  mark,
  className = "platform-mark",
}: {
  mark: PlatformMarkId;
  className?: string;
}) {
  return (
    <span className={className} aria-hidden="true">
      {platformMarks[mark]}
    </span>
  );
}

export function SocialSwitcher({ active }: { active: PlatformDefinition }) {
  const details = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    // A native details menu may already be open before hydration completes.
    // Close it on navigation, never merely because the client mounted.
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    const current = details.current;
    if (current?.open) {
      current.open = false;
      current.querySelector("summary")?.focus();
    }
  }, [pathname]);

  useEffect(() => {
    function close() {
      const current = details.current;
      if (!current?.open) return;
      current.open = false;
      current.querySelector("summary")?.focus();
    }
    function closeOutside(event: PointerEvent) {
      if (!details.current?.contains(event.target as Node)) close();
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || !details.current?.open) return;
      event.preventDefault();
      close();
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <details className="social-switcher" ref={details}>
      <summary
        className="platform-trigger"
        aria-label={`Switch platform, currently ${active.name}`}
      >
        <PlatformMark mark={active.mark} />
        <span>{active.name}</span>
        <span className="platform-chevron" aria-hidden="true">
          ⌄
        </span>
      </summary>
      <div className="social-switcher-panel">
        <p className="social-switcher-label">Explore InstaScope</p>
        {getAvailablePlatforms(true).map((platform) => (
          <Link
            href={platform.basePath}
            key={platform.id}
            data-platform={platform.id}
            aria-current={active.id === platform.id ? "true" : undefined}
            onClick={() => {
              const current = details.current;
              if (!current) return;
              current.open = false;
              current.querySelector("summary")?.focus();
            }}
          >
            <PlatformMark mark={platform.mark} />
            <span className="platform-option-copy">
              <strong>{platform.name}</strong>
              <small>{platform.description}</small>
            </span>
            {active.id === platform.id && (
              <span className="platform-selected">Current</span>
            )}
          </Link>
        ))}
      </div>
    </details>
  );
}
