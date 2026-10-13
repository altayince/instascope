"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getActivePlatform, type PlatformDefinition } from "@/lib/platforms";
import { ToolNavigation } from "./tool-navigation";
import { PlatformMark, SocialSwitcher } from "./social-switcher";
import { WhatsAppProvider } from "./whatsapp/provider";

const whatsappEnabled = process.env.NEXT_PUBLIC_WHATSAPP_ENABLED === "true";

function InstagramFooter() {
  return (
    <footer>
      <Link className="brand" href="/">
        ◎ instascope
      </Link>
      <p>A little clarity for your social circle.</p>
      <nav aria-label="Footer navigation">
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
      <small>Independent tool. Not affiliated with Instagram or Meta.</small>
    </footer>
  );
}

function OriginalInstagramShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="InstaScope home">
          <span className="brand-mark" aria-hidden="true">
            ◎
          </span>{" "}
          insta<span>scope</span>
        </Link>
        <ToolNavigation />
        <span className="header-note">
          <i /> Your data stays yours
        </span>
      </header>
      {children}
      <InstagramFooter />
    </>
  );
}

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

function PlatformFooter({ platform }: { platform: PlatformDefinition }) {
  if (platform.chrome.kind === "instagram") return <InstagramFooter />;
  return (
    <footer>
      <Link
        className="brand"
        href={platform.basePath}
        aria-label={`${platform.productName} home`}
      >
        <PlatformMark mark={platform.mark} /> {platform.productName}
      </Link>
      <p>{platform.chrome.footer.tagline}</p>
      <nav aria-label="Footer navigation">
        {platform.chrome.navigation.map((destination) => (
          <Link key={destination.href} href={destination.href}>
            {destination.label}
          </Link>
        ))}
      </nav>
      <small>{platform.chrome.footer.disclaimer}</small>
    </footer>
  );
}

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (!whatsappEnabled)
    return <OriginalInstagramShell>{children}</OriginalInstagramShell>;

  const active = getActivePlatform(pathname, whatsappEnabled);
  return (
    <WhatsAppProvider>
      <div className="platform-shell" data-platform={active.id}>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="site-header">
          <SocialSwitcher active={active} />
          <PlatformNavigation platform={active} pathname={pathname} />
          <span className="header-note">
            <i /> Your data stays yours
          </span>
        </header>
        {children}
        <PlatformFooter platform={active} />
      </div>
    </WhatsAppProvider>
  );
}
