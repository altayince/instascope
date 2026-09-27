"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { primaryTools, tools } from "@/lib/site";
export function ToolNavigation() {
  const menu = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    menu.current?.removeAttribute("open");
  }, [pathname]);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (menu.current?.open && !menu.current.contains(event.target as Node))
        menu.current?.removeAttribute("open");
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

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
