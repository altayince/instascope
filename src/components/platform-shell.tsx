"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getActivePlatform, type PlatformDefinition } from "@/lib/platforms";
import { ToolNavigation } from "./tool-navigation";
import { SocialSwitcher } from "./social-switcher";
import { WhatsAppProvider } from "./whatsapp/provider";
import "./platform-shell.css";

const whatsappEnabled = process.env.NEXT_PUBLIC_WHATSAPP_ENABLED === "true";

function PlatformNavigation({
  platform,
  pathname,
}: {
  platform: PlatformDefinition;
  pathname: string;
}) {
  if (platform.chrome.kind === "instagram") return <ToolNavigation />;
  const normalized = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return (
    <nav aria-label="Main navigation" className="product-navigation">
      {platform.chrome.navigation.map((destination) => (
        <Link
          key={destination.href}
          href={destination.href}
          aria-current={normalized === destination.href ? "page" : undefined}
        >
          {destination.label}
        </Link>
      ))}
    </nav>
  );
}

function PlatformFooter() {
  return (
    <footer className="platform-footer">
      <div>
        <Link className="brand" href="/" aria-label="InstaScope home">
          <span className="brand-mark" aria-hidden="true">
            ◎
          </span>
          InstaScope
        </Link>
        <p>Your social world. A little clearer.</p>
      </div>
      <nav aria-label="Footer navigation">
        <Link href="/">Instagram</Link>
        {whatsappEnabled && <Link href="/whatsapp/">WhatsApp</Link>}
        <Link href="/guides/">Guides</Link>
        <Link href="/privacy/">Privacy</Link>
        <Link href="/how-to-download-instagram-followers-data/">
          Export guide
        </Link>
        <Link href="/changelog/">What’s new</Link>
        <a
          href="https://github.com/altayince/instascope/issues/new?template=bug_report.yml"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Report a problem on GitHub (opens in a new tab)"
        >
          Report a problem
        </a>
      </nav>
      <small>
        Independent tool. Not affiliated with Instagram, WhatsApp or Meta.
      </small>
    </footer>
  );
}

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const active = getActivePlatform(pathname, whatsappEnabled);
  const shell = (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header" data-platform={active.id}>
        <div className="shell-identity-row">
          <Link className="brand" href="/" aria-label="InstaScope home">
            <span className="brand-mark" aria-hidden="true">
              ◎
            </span>
            InstaScope
          </Link>
          {whatsappEnabled ? (
            <SocialSwitcher active={active} />
          ) : (
            <span className="platform-trigger">Instagram</span>
          )}
          <span className="header-note">
            <i />
            Your data stays yours
          </span>
        </div>
        <PlatformNavigation platform={active} pathname={pathname} />
      </header>
      {children}
      <PlatformFooter />
    </>
  );
  return whatsappEnabled ? <WhatsAppProvider>{shell}</WhatsAppProvider> : shell;
}
