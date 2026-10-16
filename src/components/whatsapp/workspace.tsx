"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo } from "react";
import { ActionButton, ActionLink, InsightLink } from "@/components/actions";
import { analyzeWhatsApp, createWhatsAppDemo } from "@/lib/whatsapp";
import { whatsappDate, whatsappNumber } from "@/lib/whatsapp/stories";
import { useWhatsApp } from "./provider";
import { WhatsAppImport } from "./import";
import { WhatsAppAnalyzer } from "./analyzer";
import { WhatsAppWrapped } from "./wrapped";
import { WhatsAppDoctor } from "./doctor";
import { ChatVaultSaver } from "./chat-vault-save";
import { WhatsAppChatVault } from "./chat-vault";
import "./whatsapp.css";
import { useBrowserReady } from "@/components/use-browser-ready";

export type WhatsAppWorkspaceMode =
  "overview" | "analyzer" | "wrapped" | "vault";

function LandingPreview() {
  const analysis = useMemo(() => analyzeWhatsApp(createWhatsAppDemo()), []);
  return (
    <section className="wa-landing-preview" aria-labelledby="wa-preview-title">
      <span className="wa-eyebrow">InstaScope / WhatsApp</span>
      <h2 id="wa-preview-title">Recorded chat facts</h2>
      <p className="wa-preview-source">Demo data · Fictional example</p>
      <div className="wa-stat-grid">
        <div className="wa-stat wa-stat-featured">
          <span>Exported messages</span>
          <strong>{whatsappNumber(analysis.totals.messages)}</strong>
        </div>
        <div className="wa-stat">
          <span>Active dates</span>
          <strong>{whatsappNumber(analysis.totals.activeDays)}</strong>
        </div>
        <div className="wa-stat">
          <span>Participant labels</span>
          <strong>{whatsappNumber(analysis.totals.participants)}</strong>
        </div>
        <div className="wa-stat">
          <span>Media markers</span>
          <strong>{whatsappNumber(analysis.totals.mediaMessages)}</strong>
        </div>
      </div>
      <p className="wa-preview-note">
        Fictional export totals. Labels are not verified people; media contents
        are unavailable.
      </p>
    </section>
  );
}

function LandingHero({
  onDemo,
  ready,
  hasChat,
}: {
  onDemo: () => void;
  ready: boolean;
  hasChat: boolean;
}) {
  return (
    <>
      <section className="wa-hero" aria-labelledby="wa-title">
        <div className="wa-hero-copy">
          <span className="wa-eyebrow">
            <i aria-hidden="true" /> INSTASCOPE / WHATSAPP
          </span>
          <h1 id="wa-title">
            Your conversations.
            <br />
            <em>A new perspective.</em>
          </h1>
          <p>
            Find the patterns in your WhatsApp conversations. Explore message
            counts, recorded dates and everyday rhythms. Turn the facts into a
            Wrapped worth sharing.
          </p>
          <div className="wa-hero-actions">
            {hasChat ? (
              <>
                <ActionLink variant="primary" href="/whatsapp/chat-analyzer/">
                  Continue to Chat Analyzer
                </ActionLink>
                <ActionLink variant="tertiary" href="/whatsapp/wrapped/">
                  Open WhatsApp Wrapped
                </ActionLink>
              </>
            ) : (
              <>
                <a className="button primary" href="#wa-import-title">
                  Explore your chat
                </a>
                <ActionButton
                  variant="tertiary"
                  onClick={onDemo}
                  disabled={!ready}
                >
                  Try a fictional demo
                </ActionButton>
              </>
            )}
          </div>
          <p className="wa-hero-reassurance">
            Your export stays on this device. No login needed.
          </p>
        </div>
        <LandingPreview />
      </section>
      <nav className="wa-promise-strip" aria-label="How InstaScope works">
        <a href="#wa-import-title">
          <i aria-hidden="true">01</i> Open a local export
        </a>
        <Link
          href={
            hasChat
              ? "/whatsapp/chat-analyzer/"
              : "/whatsapp/chat-analyzer/#wa-import-title"
          }
        >
          <i aria-hidden="true">02</i>
          <span>
            Explore the recorded facts
            <small>
              {hasChat
                ? "Continue with your loaded chat"
                : "Import a chat or try the demo in Analyzer"}
            </small>
          </span>
        </Link>
        <Link
          href={
            hasChat
              ? "/whatsapp/wrapped/"
              : "/whatsapp/wrapped/#wa-import-title"
          }
        >
          <i aria-hidden="true">03</i>
          <span>
            Make your own Wrapped
            <small>
              {hasChat
                ? "Use your loaded chat"
                : "Import a chat or try the demo in Wrapped"}
            </small>
          </span>
        </Link>
      </nav>
    </>
  );
}

export function WhatsAppWorkspace({ mode }: { mode: WhatsAppWorkspaceMode }) {
  const router = useRouter();
  const ready = useBrowserReady();
  const { dataset, revision, analysis, busy, clear, startDemo } = useWhatsApp();
  const demo = dataset?.metadata.source === "demo";
  function imported() {
    if (mode === "overview") router.push("/whatsapp/chat-analyzer/");
  }
  function exploreDemo() {
    startDemo();
    imported();
  }
  if (mode === "vault") return <WhatsAppChatVault />;
  return (
    <main id="main" className="wa-workspace" data-whatsapp-mode={mode}>
      {mode === "overview" ? (
        <LandingHero
          onDemo={exploreDemo}
          ready={ready}
          hasChat={Boolean(dataset)}
        />
      ) : (
        <section className="wa-page-heading">
          <span className="wa-eyebrow">
            WHATSAPP / {mode === "analyzer" ? "CHAT ANALYZER" : "WRAPPED"}
          </span>
          <h1 id="wa-title">
            {mode === "analyzer" ? (
              <>
                A closer look at <em>your chat.</em>
              </>
            ) : (
              <>
                Your conversation, <em>Wrapped.</em>
              </>
            )}
          </h1>
          <p>
            {mode === "analyzer"
              ? "A clear view of the messages, dates and patterns recorded in your local export."
              : "Small facts from a conversation. A set of cards to keep or share, made on this device."}
          </p>
        </section>
      )}

      {dataset && analysis && (
        <>
          <div className="wa-current-chat" role="status">
            <span className="wa-current-mark" aria-hidden="true">
              ✓
            </span>
            <div>
              <strong>
                {demo ? "Fictional demo chat" : "Chat loaded locally"}
              </strong>
              <span>
                {whatsappNumber(analysis.totals.messages)} messages ·{" "}
                {whatsappNumber(analysis.totals.participants)} participant
                labels
                {analysis.first &&
                  ` · From ${whatsappDate(analysis.first.date, true)}`}
              </span>
            </div>
            <InsightLink href="#wa-import">Open another export</InsightLink>
            <ActionButton variant="tertiary" onClick={clear}>
              Clear chat
            </ActionButton>
          </div>
          {demo && (
            <p className="wa-demo-notice">
              <strong>Demo data · Fictional example.</strong> These names and
              messages were created for this preview. Open your own export to
              see your chat&apos;s results.
            </p>
          )}
          {dataset.metadata.warnings.length > 0 && (
            <details className="wa-reading-notes">
              <summary>
                Reading notes &amp; limitations{" "}
                <span>{dataset.metadata.warnings.length}</span>
              </summary>
              <ul>
                {dataset.metadata.warnings.map((warning) => (
                  <li key={warning.code}>
                    {warning.message}
                    {warning.count !== undefined &&
                      ` (${whatsappNumber(warning.count)})`}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <WhatsAppDoctor key={`doctor-${revision}`} dataset={dataset} />
          {mode === "analyzer" && (
            <ChatVaultSaver key={`vault-${revision}`} dataset={dataset} />
          )}
          {mode === "analyzer" && (
            <WhatsAppAnalyzer
              key={revision}
              dataset={dataset}
              analysis={analysis}
            />
          )}
          {mode === "wrapped" && (
            <WhatsAppWrapped
              key={revision}
              dataset={dataset}
              analysis={analysis}
            />
          )}
          {mode === "overview" && (
            <div className="wa-loaded-overview">
              <h2>Your chat is ready to explore.</h2>
              <p>
                Move through its recorded activity, or make a card of the facts.
              </p>
              <div>
                <ActionLink variant="primary" href="/whatsapp/chat-analyzer/">
                  Open Chat Analyzer <span aria-hidden="true">↗</span>
                </ActionLink>
                <ActionLink href="/whatsapp/wrapped/">
                  Make your Wrapped <span aria-hidden="true">↗</span>
                </ActionLink>
              </div>
            </div>
          )}
        </>
      )}

      <WhatsAppImport onImported={imported} />
      {mode === "overview" && (
        <section
          className="wa-feature-section"
          aria-labelledby="wa-features-title"
        >
          <div className="wa-section-title">
            <span className="wa-eyebrow">
              A DIFFERENT VIEW OF YOUR EVERYDAY
            </span>
            <h2 id="wa-features-title">
              From chat history to <em>a clearer picture.</em>
            </h2>
          </div>
          <div className="wa-feature-grid">
            <article>
              <span className="wa-feature-number">01 / THE CONVERSATION</span>
              <h3>See the shape of your chat.</h3>
              <p>
                Messages by participant. Active dates. The months with more to
                say. A calendar of what the export actually contains.
              </p>
              <InsightLink href="/whatsapp/chat-analyzer/">
                Explore Chat Analyzer
              </InsightLink>
            </article>
            <article>
              <span className="wa-feature-number">02 / THE VAULT</span>
              <h3>A record, without the chat.</h3>
              <p>
                Keep anonymous totals on this device. Compare saved exports
                without saving message text or participant identities.
              </p>
              <InsightLink href="/whatsapp/chat-vault/">
                Explore Chat Vault
              </InsightLink>
            </article>
            <article>
              <span className="wa-feature-number">03 / THE WRAPPED</span>
              <h3>Keep a little perspective.</h3>
              <p>
                Make a phone-sized deck of count and date cards. Download a PNG
                or open your device&apos;s share menu, with personal names
                anonymized.
              </p>
              <InsightLink href="/whatsapp/wrapped/">
                Discover WhatsApp Wrapped
              </InsightLink>
            </article>
          </div>
        </section>
      )}
      <div className="wa-privacy-footer">
        <span aria-hidden="true">◉</span>
        <p>
          Your chat stays in this tab&apos;s memory. Switching tools keeps it
          available; clearing it, refreshing or closing the tab discards this
          working copy.{" "}
          {busy
            ? "You can clear the chat to stop using this import's result."
            : "No archive is sent to a server or written to browser storage."}
        </p>
      </div>
    </main>
  );
}
