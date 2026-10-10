"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeProductSection, productSections } from "@/lib/navigation";
import { useData } from "./data-provider";
export function ToolNavigation() {
  const navigation = useRef<HTMLElement>(null);
  const pathname = usePathname();
  const { dataset } = useData();
  const section = activeProductSection(pathname);

  function closeMenus() {
    navigation.current
      ?.querySelectorAll<HTMLDetailsElement>("details[open]")
      .forEach((menu) => menu.removeAttribute("open"));
  }

  useEffect(() => {
    navigation.current
      ?.querySelectorAll<HTMLDetailsElement>("details[open]")
      .forEach((menu) => menu.removeAttribute("open"));
  }, [pathname]);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      navigation.current
        ?.querySelectorAll<HTMLDetailsElement>("details[open]")
        .forEach((menu) => {
          if (!menu.contains(event.target as Node))
            menu.removeAttribute("open");
        });
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  return (
    <nav
      aria-label="Main navigation"
      className="product-navigation"
      ref={navigation}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          const menu =
            (event.target as HTMLElement).closest("details") ??
            navigation.current?.querySelector("details[open]");
          if (menu) {
            event.preventDefault();
            closeMenus();
            menu.querySelector("summary")?.focus();
          }
        }
      }}
    >
      <Link
        href="/dashboard/"
        aria-current={pathname === "/dashboard/" ? "page" : undefined}
        onClick={closeMenus}
      >
        Dashboard
      </Link>
      {productSections.map((group) =>
        group.id === "wrapped" ? (
          <Link
            key={group.id}
            href={group.links[0].href}
            aria-current={section === "wrapped" ? "page" : undefined}
            onClick={closeMenus}
          >
            Wrapped
          </Link>
        ) : (
          <details
            className="tool-menu"
            data-section={group.id}
            data-active={section === group.id ? "true" : undefined}
            key={group.id}
            onToggle={(event) => {
              const current = event.currentTarget;
              if (!current.open) return;
              navigation.current
                ?.querySelectorAll<HTMLDetailsElement>("details[open]")
                .forEach((menu) => {
                  if (menu !== current) menu.removeAttribute("open");
                });
            }}
          >
            <summary>{group.label}</summary>
            <div className="tool-menu-links">
              <p className="nav-section-note">{group.description}</p>
              {group.links.map((destination) => (
                <Link
                  key={destination.href}
                  href={
                    destination.href === "/snapshot-vault/" &&
                    dataset?.metadata.demo
                      ? "/snapshot-vault/?demo=true"
                      : destination.href
                  }
                  aria-current={
                    pathname === destination.href ? "page" : undefined
                  }
                  onClick={closeMenus}
                >
                  {destination.label}
                </Link>
              ))}
            </div>
          </details>
        ),
      )}
    </nav>
  );
}
