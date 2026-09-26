"use client";
import { useRef } from "react";
import Link from "next/link";
import { primaryTools, tools } from "@/lib/site";
export function ToolNavigation() {
  const menu = useRef<HTMLDetailsElement>(null);
  return (
    <details
      className="tool-menu"
      ref={menu}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          menu.current?.removeAttribute("open");
          menu.current?.querySelector("summary")?.focus();
        }
      }}
    >
      <summary>All tools</summary>
      <div className="tool-menu-links">
        {primaryTools.map((slug) => (
          <Link
            key={slug}
            href={`/${slug}/`}
            onClick={() => menu.current?.removeAttribute("open")}
          >
            {tools[slug].name}
          </Link>
        ))}
      </div>
    </details>
  );
}
