"use client";

import { useRouter } from "next/navigation";
import { ActionButton, ActionLink, InsightLink } from "@/components/actions";
import { whatsappDate, whatsappNumber } from "@/lib/whatsapp/stories";
import { useWhatsApp } from "./provider";
import { WhatsAppImport } from "./import";
import { WhatsAppAnalyzer } from "./analyzer";
import { WhatsAppWrapped } from "./wrapped";
import { WhatsAppDoctor } from "./doctor";
import "./whatsapp.css";
import { useBrowserReady } from "@/components/use-browser-ready";

export type WhatsAppWorkspaceMode = "overview" | "analyzer" | "wrapped";

function LandingHero({
  onDemo,
  ready,
}: {
  onDemo: () => void;
  ready: boolean;
}) {
  return (
    <>
      <section className="wa-hero" aria-labelledby="wa-title">
        <div className="wa-hero-copy">
          <span className="wa-eyebrow">
            <i aria-hidden="true" /> PRIVATE BY DESIGN. CURIOUS BY NATURE.
          </span>
          <h1 id="wa-title">
            Every chat has
            <br />a <em>little history.</em>
          </h1>
          <p>
            Find the patterns in your WhatsApp conversations. Explore message
            counts, recorded dates and everyday rhythms. Turn the facts into a
            Wrapped worth sharing.
          </p>
          <div className="wa-hero-actions">
            <ActionLink variant="primary" href="#wa-import">
              Explore your chat <span aria-hidden="true">↗</span>
            </ActionLink>
            <ActionButton variant="tertiary" onClick={onDemo} disabled={!ready}>
              Try a fictional demo <span aria-hidden="true">→</span>
            </ActionButton>
          </div>
          <p className="wa-hero-reassurance">
            Your export stays on this device. No login needed.
          </p>
        </div>
        <div className="wa-hero-art" aria-hidden="true">
          <div className="wa-art-heading">
            <span>WHATSAPPSCOPE</span>
            <i>↗</i>
          </div>
          <div className="wa-art-bubble">
            The catch-ups.
            <br />
            The plans.
            <br />
            <em>The everyday.</em>
          </div>
          <div className="wa-art-reply">
            A little perspective
            <br />
            on all those messages.
          </div>
          <div className="wa-art-chart">
            <span>YOUR CONVERSATION, IN PERSPECTIVE</span>
            <div>
              {[22, 41, 30, 64, 48, 86, 58, 100, 67, 46, 76, 55].map(
                (height, index) => (
                  <i key={index} style={{ height: `${height}%` }} />
                ),
              )}
            </div>
            <small>
              An illustrated preview. Your results come from your export.
            </small>
          </div>
          <div className="wa-art-footer">
            <span>Local files. Clear facts.</span>
            <span>01 / 03</span>
          </div>
        </div>
      </section>
      <div className="wa-promise-strip" aria-label="How WhatsAppScope works">
        <span>
          <i aria-hidden="true">01</i> Open a local export
        </span>
        <span>
          <i aria-hidden="true">02</i> Explore the recorded facts
        </span>
        <span>
          <i aria-hidden="true">03</i> Make your own Wrapped
        </span>
      </div>
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
  return (
    <main id="main" className="wa-workspace" data-whatsapp-mode={mode}>
      {mode === "overview" ? (
        <LandingHero onDemo={exploreDemo} ready={ready} />
      ) : (
        <section className="wa-page-heading">
          <span className="wa-eyebrow">
            WHATSAPPSCOPE / {mode === "analyzer" ? "CHAT ANALYZER" : "WRAPPED"}
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
          <WhatsAppDoctor dataset={dataset} />
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
              <span className="wa-feature-number">02 / THE RHYTHM</span>
              <h3>Find your recorded patterns.</h3>
              <p>
                Look at activity by hour and weekday. See a longest run of
                active dates, with clear limits on what those numbers mean.
              </p>
              <InsightLink href="#wa-import">
                Start with your export
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
