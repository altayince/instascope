"use client";

import { useState, type ReactNode } from "react";
import { ActionButton } from "@/components/actions";
import type {
  WhatsAppBurst,
  WhatsAppContentAnalysis,
  WhatsAppWordComparison,
  WhatsAppWordFrequency,
} from "@/lib/whatsapp/content-types";
import type {
  WhatsAppCountBucket,
  WhatsAppParticipant,
} from "@/lib/whatsapp/types";
import { whatsappNumber } from "@/lib/whatsapp/stories";

const PARTICIPANT_PAGE_SIZE = 8;
const LEADERBOARD_SIZE = 20;
const shareFormatter = new Intl.NumberFormat("en-GB", {
  style: "percent",
  maximumFractionDigits: 1,
});
const rateFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 2,
});
const count = (value: number | null) =>
  value === null ? "Unavailable" : whatsappNumber(value);
const share = (value: number | null) =>
  value === null ? "Unavailable" : shareFormatter.format(value);

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function CountList({
  items,
  label,
  bars = false,
}: {
  items: readonly WhatsAppCountBucket[];
  label: string;
  bars?: boolean;
}) {
  // Scaling changes presentation only; counts come from the pure analysis.
  const maximum = bars ? Math.max(0, ...items.map((item) => item.count)) : 0;
  return (
    <ul
      className={`wa-message-content-counts${bars ? " has-bars" : ""}`}
      aria-label={label}
    >
      {items.map((item) => (
        <li key={item.key}>
          <span>{item.label}</span>
          <strong>{whatsappNumber(item.count)}</strong>
          {bars && (
            <div className="wa-message-content-track" aria-hidden="true">
              <i
                style={{
                  width: `${maximum ? (item.count / maximum) * 100 : 0}%`,
                }}
              />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function BurstContext({ burst }: { burst: WhatsAppBurst }) {
  if (!burst.maximum)
    return <p className="wa-hint">Recorded window context is unavailable.</p>;
  return (
    <div className="wa-message-content-burst-context">
      <p className="wa-hint">
        {whatsappNumber(burst.tiedWindows)} maximizing recorded{" "}
        {burst.tiedWindows === 1 ? "window" : "windows"}
        {burst.tiedWindows > 1 ? " (tied)" : ""}. Recorded message bounds within
        up to three maximum windows:
      </p>
      <ul aria-label="Recorded message bounds within maximum burst windows">
        {burst.examples.slice(0, 3).map((example) => (
          <li key={`${example.from}-${example.to}`}>
            <time dateTime={example.from}>
              {example.from.replace("T", " ")}
            </time>
            {" to "}
            <time dateTime={example.to}>{example.to.replace("T", " ")}</time>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ParticipantRows<T extends WhatsAppParticipant>({
  participants,
  kind,
  children,
}: {
  participants: readonly T[];
  kind: "message patterns" | "media & emoji" | "words";
  children: (participant: T) => ReactNode;
}) {
  const [selectedPage, setSelectedPage] = useState(0);
  const lastPage = Math.max(
    0,
    Math.ceil(participants.length / PARTICIPANT_PAGE_SIZE) - 1,
  );
  const page = Math.min(selectedPage, lastPage);
  const start = page * PARTICIPANT_PAGE_SIZE;
  const visible = participants.slice(start, start + PARTICIPANT_PAGE_SIZE);
  return (
    <details className="wa-message-content-participants">
      <summary>Read participant {kind}</summary>
      {!participants.length ? (
        <p className="wa-hint">No matching participant labels to show.</p>
      ) : (
        <>
          <p className="wa-hint">
            Exported labels retain their accepted order and are not verified
            identities. Open a label to read its values.
          </p>
          <div className="wa-message-content-participant-rows">
            {visible.map((participant) => (
              <details key={participant.id}>
                <summary>{participant.displayName}</summary>
                <div className="wa-message-content-participant-body">
                  {children(participant)}
                </div>
              </details>
            ))}
          </div>
          {lastPage > 0 && (
            <div className="wa-message-content-pagination">
              <ActionButton
                disabled={page === 0}
                onClick={() => setSelectedPage(page - 1)}
              >
                Previous {kind} participants
              </ActionButton>
              <span aria-live="polite">
                {whatsappNumber(start + 1)}–
                {whatsappNumber(start + visible.length)} of{" "}
                {whatsappNumber(participants.length)} labels
              </span>
              <ActionButton
                disabled={page === lastPage}
                onClick={() => setSelectedPage(page + 1)}
              >
                Next {kind} participants
              </ActionButton>
            </div>
          )}
        </>
      )}
    </details>
  );
}

function WordList({
  words,
  label,
}: {
  words: readonly WhatsAppWordFrequency[];
  label: string;
}) {
  if (!words.length)
    return <p className="wa-hint">No words meet the top-word thresholds.</p>;
  return (
    <ol className="wa-message-content-word-list" aria-label={label}>
      {words.slice(0, LEADERBOARD_SIZE).map((item) => (
        <li key={item.word}>
          <span>{item.word}</span>
          <strong>{whatsappNumber(item.count)}</strong>
        </li>
      ))}
    </ol>
  );
}

function WordCloud({ words }: { words: readonly WhatsAppWordFrequency[] }) {
  const visible = words.slice(0, LEADERBOARD_SIZE);
  const maximum = Math.max(0, ...visible.map((item) => item.count));
  return (
    <div className="wa-message-content-cloud-area">
      <h5>Local word cloud</h5>
      <p className="wa-hint">
        The same top words, in the same order. Size reflects frequency only.
      </p>
      {visible.length ? (
        <div
          className="wa-message-content-cloud"
          data-testid="wa-content-word-cloud"
          aria-hidden="true"
        >
          {visible.map((item) => (
            <span
              key={item.word}
              style={{ fontSize: `${14 + (item.count / maximum) * 22}px` }}
            >
              {item.word}
            </span>
          ))}
        </div>
      ) : (
        <p className="wa-hint">No eligible top words for a word cloud.</p>
      )}
      <details className="wa-message-content-values">
        <summary>Read word cloud values</summary>
        <div data-testid="wa-content-word-cloud-values">
          <WordList words={visible} label="Word cloud words and counts" />
        </div>
      </details>
    </div>
  );
}

function ComparedWords({ comparison }: { comparison: WhatsAppWordComparison }) {
  if (!comparison.available) {
    const reasons = {
      "participant-filter":
        "The participant filter removes the other labels. Select Everyone to compare eligible word frequencies.",
      "one-participant":
        "At least two participant labels are needed in the selected records.",
      "insufficient-data":
        "This label and all other labels combined each need at least 20 eligible words in the selected records.",
    };
    return (
      <p className="wa-hint" data-testid="wa-content-comparison">
        Unavailable. {reasons[comparison.reason]}
      </p>
    );
  }
  if (!comparison.words.length)
    return (
      <p className="wa-hint" data-testid="wa-content-comparison">
        Comparison is available. No words meet the comparison thresholds.
      </p>
    );
  return (
    <div
      className="wa-message-content-table-scroll"
      role="region"
      aria-label="Word comparison table; scroll to read all columns"
      tabIndex={0}
      data-testid="wa-content-comparison"
    >
      <table className="wa-message-content-comparison-table">
        <caption>
          Words used disproportionately often: this label versus all other
          selected labels. Rates are smoothed occurrences per 1,000 eligible
          words; equal scores remain ties.
        </caption>
        <thead>
          <tr>
            <th scope="col">Word</th>
            <th scope="col">Occurrences for this label</th>
            <th scope="col">Occurrences for others</th>
            <th scope="col">Rate for this label</th>
            <th scope="col">Rate for others</th>
            <th scope="col">Rate ratio</th>
          </tr>
        </thead>
        <tbody>
          {comparison.words.slice(0, 10).map((word) => (
            <tr key={word.word}>
              <th scope="row">{word.word}</th>
              <td>{whatsappNumber(word.count)}</td>
              <td>{whatsappNumber(word.otherCount)}</td>
              <td>{rateFormatter.format(word.perThousand)}</td>
              <td>{rateFormatter.format(word.otherPerThousand)}</td>
              <td>{rateFormatter.format(word.ratio)}×</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContentMethodology() {
  return (
    <details className="wa-message-content-methodology">
      <summary>How Message Patterns &amp; Content is calculated</summary>
      <dl className="wa-message-content-truth">
        <Fact label="Exact under the accepted-record definitions">
          Supported media-marker counts, supported emoji occurrences, literal
          question-mark counts and lexical token counts describe accepted
          participant records. Exported labels are not verified identities.
        </Fact>
        <Fact label="Derived">
          Runs and their distributions, rolling bursts, length summaries,
          filtered top words and word-comparison scores apply the deterministic
          definitions below to the selected records.
        </Fact>
        <Fact label="Unavailable">
          Sentiment, intent, personality, relationship quality, real replies,
          read or seen data and attachment contents are unavailable.
        </Fact>
      </dl>
      <ul>
        <li>
          Date and participant filters are authoritative. All values recompute
          from matching accepted records without reparsing. Runs and bursts sort
          participant messages by recorded wall-clock values, then source record
          ID for equal timestamps. System events neither increase nor split
          runs. A participant switch ends a run; no gap threshold is applied.
          Run-length buckets are 1, 2, 3–5, 6–10 and 11+ messages. Selecting one
          label describes that label&apos;s filtered subsequence, with other
          labels removed. Date edges can truncate a run. A two-message run
          carries no interpretation of intent.
        </li>
        <li>
          Highest recorded 10-minute message burst is the largest participant
          message count in any rolling window of 600 recorded seconds, including
          both endpoints. Per-label bursts use that label&apos;s matching
          messages. One candidate ends at each distinct recorded message time,
          with all messages at that time included together. Tied maximizing end
          times are counted, including overlapping windows; up to three contexts
          show the first and last included message times. No timezone or
          daylight-saving correction is inferred. Equal timestamps follow source
          order, not proof of real event order.
        </li>
        <li>
          Messages containing a question mark counts selected participant
          messages with at least one literal ASCII ?. Total occurrences count
          every ? in those records, including inside URLs. The share divides
          matching messages by all selected participant messages, rounded to one
          decimal place. This is literal counting, not semantic question
          detection; other question-mark characters are not counted.
        </li>
        <li>
          Length uses Unicode code points after NFC normalization and trimming
          leading and trailing whitespace. Interior spaces, newlines,
          punctuation and URL characters count; an emoji sequence can span
          several code points. Eligible ordinary text excludes recognized media,
          call, deleted-message and location records, and unclassified
          structural marker prefixes and trimmed empty text. Median word units
          per eligible text message counts lexical units after removing URLs and
          email addresses, before top-word stopword and minimum-length
          exclusions. It does not count emoji or pure numbers.
        </li>
        <li>
          Median, p25 and p75 use sorted values and linear interpolation at rank
          (n − 1) × p, with p equal to 0.5, 0.25 or 0.75. Fractional summaries
          are derived values, displayed to at most three decimal places. Empty
          samples have unavailable summaries and shares; exact counts are zero.
          Equal values are ties.
        </li>
        <li>
          Media counts use only the seven existing parser categories: images,
          videos, audio/voice, stickers, GIFs, documents and unspecified.
          Attachments are never inspected. Emoji counts reuse supported grapheme
          extraction; runtimes without that capability show Unavailable,
          including an empty selection. Leaderboards show up to 20 emoji per
          scope with their occurrence counts.
        </li>
        <li>
          Lexical analysis removes URLs, email addresses and structural markers
          before finding runs of Unicode letters and combining marks.
          Apostrophes, hyphens, punctuation and numbers delimit tokens; pure
          numbers and emoji contribute no word units. URL removal covers
          scheme:// and www. tokens, plus mailto:, tel:, sms:, urn: and data:
          prefixes; bare hostnames without a scheme or www. remain text. NFC
          normalization and default Unicode lowercasing apply, with Turkish İ
          and i plus a combining dot mapped to i. ASCII I also maps to i under
          this fixed rule; no Turkish locale is inferred. Dotless ı, ß versus
          ss, umlauts and accents remain distinct. There is no language
          detection or stemming.
        </li>
        <li>
          Top-word eligibility requires 2–40 code points and exclusion from one
          combined, maintained Turkish, German and English stopword set. A
          displayed word needs at least two occurrences in its scope; up to 20
          words are ordered by descending count, then deterministic lexical
          order for ties. Eligible-word totals include eligible words below the
          display occurrence threshold. The local word cloud uses these same
          words and order; font size depends only on count.
        </li>
        <li>
          Words used disproportionately often compares one label with all other
          selected labels combined. Each side needs at least 20 eligible words;
          a candidate needs at least three occurrences for that label. The
          smoothed rate per 1,000 is (occurrences + 0.5) / (eligible words + 1)
          × 1,000. The ratio divides that label&apos;s rate by the others&apos;
          rate; candidates need a ratio of at least 2. Up to ten words are
          shown, ordered by ratio descending, then own count descending, then
          deterministic lexical order. Equal scores remain ties. Rates and
          ratios display at most two decimal places. One label, insufficient
          data or a participant filter makes comparison unavailable; a valid
          comparison may have no qualifying words. It does not identify
          preferences or personality.
        </li>
        <li>
          Message bodies, words and participant labels stay in browser memory.
          This area shows aggregate lexical counts and timestamp contexts, never
          message samples. It sends no content to analytics or remote services
          and writes no chat content to URLs or browser storage.
        </li>
      </ul>
    </details>
  );
}

export function WhatsAppTopInsights({
  result,
}: {
  result: WhatsAppContentAnalysis;
}) {
  const { text, emoji } = result;
  return (
    <section
      className="wa-panel wa-message-content wa-top-insights"
      aria-labelledby="wa-top-words-title"
    >
      <div className="wa-top-insight-grid">
        <div>
          <div className="wa-message-content-two-columns">
            <div>
              <h3 id="wa-top-words-title">Most used words</h3>
              <WordList
                words={text.words}
                label="Top words and occurrence counts"
              />
            </div>
            <WordCloud words={text.words} />
          </div>
        </div>
        <div className="wa-top-emoji">
          <div>
            <h3>Top emoji</h3>
            {emoji.available ? (
              <>
                <p className="wa-hint">
                  {count(emoji.total)} supported occurrences. Up to 20 emoji,
                  ordered by count; equal counts are ties.
                </p>
                {emoji.items.length ? (
                  <CountList
                    items={emoji.items.slice(0, LEADERBOARD_SIZE)}
                    label="Top supported emoji and occurrence counts"
                  />
                ) : (
                  <p className="wa-hint">
                    No supported emoji in the selected records.
                  </p>
                )}
              </>
            ) : (
              <p className="wa-hint">
                Unavailable. Supported emoji grapheme extraction is not
                available in this browser, including for an empty selection.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function WhatsAppMessageContent({
  result,
  participantSelected = false,
}: {
  result: WhatsAppContentAnalysis;
  participantSelected?: boolean;
}) {
  const { patterns, text, media, emoji } = result;
  // Joining presentation rows by accepted participant ID adds no calculations.
  const textByParticipant = new Map(
    text.participants.map((participant) => [participant.id, participant]),
  );
  const emojiByParticipant = new Map(
    emoji.participants.map((participant) => [participant.id, participant]),
  );
  return (
    <section
      className="wa-panel wa-message-content"
      aria-labelledby="wa-message-content-title"
    >
      <div className="wa-panel-heading">
        <div>
          <span className="wa-eyebrow">LOCAL COUNTS, RECORDED PATTERNS</span>
          <h3 id="wa-message-content-title">Message Patterns &amp; Content</h3>
        </div>
        <span className="wa-panel-badge">Selected records</span>
      </div>
      <p>
        Participant messages matching the current date and label filters. Counts
        describe supplied text, with no interpretation of intent.
      </p>
      {!patterns.messageCount && (
        <p className="wa-hint" role="status">
          No participant messages match these filters. Counts are zero; medians,
          shares and comparison data are unavailable.
        </p>
      )}
      {participantSelected && (
        <p className="wa-hint">
          Other labels have been removed. Runs describe only the selected
          label&apos;s matching subsequence; bursts use its matching messages.
          Participant word comparison is unavailable with this filter.
        </p>
      )}
      <section
        className="wa-message-content-group"
        aria-labelledby="wa-content-patterns-title"
        data-testid="wa-content-patterns"
      >
        <h4 id="wa-content-patterns-title">Message patterns</h4>
        <div className="wa-message-content-pattern-summaries">
          <div>
            <h5>Consecutive-message runs</h5>
            <dl className="wa-message-content-facts">
              <Fact label="Total runs">{count(patterns.runs.total)}</Fact>
              <Fact label="Median run length">
                {count(patterns.runs.medianLength)}
              </Fact>
              <Fact label="Longest run">{count(patterns.runs.longest)}</Fact>
            </dl>
            <p className="wa-hint">
              Consecutive messages with the same exported label. A label switch
              ends the run; system events are ignored.
            </p>
          </div>
          <div>
            <h5>Highest recorded 10-minute message burst</h5>
            <dl className="wa-message-content-facts">
              <Fact label="Maximum messages in a rolling 10-minute window">
                {count(patterns.burst.maximum)}
              </Fact>
            </dl>
            <BurstContext burst={patterns.burst} />
          </div>
          <div>
            <h5>Messages containing a question mark</h5>
            <dl className="wa-message-content-facts">
              <Fact label="Messages containing at least one literal ?">
                {count(patterns.questionMarks.messages)}
              </Fact>
              <Fact label="Total ? occurrences">
                {count(patterns.questionMarks.occurrences)}
              </Fact>
              <Fact label="Share of selected participant messages">
                {share(patterns.questionMarks.share)}
              </Fact>
            </dl>
            <p className="wa-hint">
              Literal ASCII ? characters, including in URLs. This does not
              detect semantic questions.
            </p>
          </div>
        </div>
        <div className="wa-message-content-pattern-bottom">
          <div>
            <h5>Run-length distribution</h5>
            <CountList
              items={patterns.runs.distribution}
              label="Run-length distribution counts"
              bars
            />
          </div>
          <div>
            <h5>Ordinary text length</h5>
            <dl className="wa-message-content-facts is-inline">
              <Fact label="Eligible text messages">
                {count(text.eligibleTextMessages)}
              </Fact>
              <Fact label="Median message length">
                {count(text.length.median)}
              </Fact>
              <Fact label="P25 / P75 length">
                {count(text.length.p25)} / {count(text.length.p75)}
              </Fact>
              <Fact label="Median word units per eligible text message">
                {count(text.wordsPerMessage.median)}
              </Fact>
            </dl>
            <p className="wa-hint">
              Length is NFC-normalized, trimmed Unicode code points, including
              interior spaces, newlines and punctuation. Structural records are
              excluded. Word units are counted before top-word exclusions.
            </p>
          </div>
        </div>
        <ParticipantRows
          participants={patterns.participants}
          kind="message patterns"
        >
          {(participant) => {
            const participantText = textByParticipant.get(participant.id);
            return (
              <>
                <dl className="wa-message-content-facts is-inline">
                  <Fact label="Run count">{count(participant.runs.count)}</Fact>
                  <Fact label="Median run length">
                    {count(participant.runs.medianLength)}
                  </Fact>
                  <Fact label="Longest run">
                    {count(participant.runs.longest)}
                  </Fact>
                  <Fact label="Highest recorded 10-minute message burst">
                    {count(participant.burst.maximum)}
                  </Fact>
                  <Fact label="Messages containing a question mark">
                    {count(participant.questionMarks.messages)}
                  </Fact>
                  <Fact label="Total ? occurrences">
                    {count(participant.questionMarks.occurrences)}
                  </Fact>
                  <Fact label="Share of this label's selected messages">
                    {share(participant.questionMarks.share)}
                  </Fact>
                  <Fact label="Eligible text messages">
                    {count(participantText?.eligibleTextMessages ?? 0)}
                  </Fact>
                  <Fact label="Median message length (code points)">
                    {count(participantText?.length.median ?? null)}
                  </Fact>
                  <Fact label="Median word units per eligible text message">
                    {count(participantText?.wordsPerMessage.median ?? null)}
                  </Fact>
                </dl>
                <BurstContext burst={participant.burst} />
              </>
            );
          }}
        </ParticipantRows>
      </section>
      <section
        className="wa-message-content-group"
        aria-labelledby="wa-content-media-title"
        data-testid="wa-content-media"
      >
        <h4 id="wa-content-media-title">Media &amp; emoji</h4>
        <div className="wa-message-content-two-columns">
          <div>
            <h5>Media breakdown</h5>
            <p className="wa-hint">
              {count(media.total)} supported media markers. Attachments are not
              inspected.
            </p>
            <CountList items={media.categories} label="Media marker counts" />
          </div>
        </div>
        <ParticipantRows participants={media.participants} kind="media & emoji">
          {(participant) => {
            const participantEmoji = emojiByParticipant.get(participant.id);
            return (
              <div className="wa-message-content-two-columns">
                <div>
                  <h5>Media markers: {count(participant.total)}</h5>
                  <CountList
                    items={participant.categories}
                    label={`${participant.displayName}: media marker counts`}
                  />
                </div>
                <div>
                  <h5>Top emoji for this label</h5>
                  {!emoji.available ? (
                    <p className="wa-hint">Unavailable in this browser.</p>
                  ) : participantEmoji?.items.length ? (
                    <>
                      <p className="wa-hint">
                        {count(participantEmoji.total)} supported occurrences.
                      </p>
                      <CountList
                        items={participantEmoji.items.slice(
                          0,
                          LEADERBOARD_SIZE,
                        )}
                        label={`${participant.displayName}: top emoji occurrence counts`}
                      />
                    </>
                  ) : (
                    <p className="wa-hint">
                      No supported emoji for this label.
                    </p>
                  )}
                </div>
              </div>
            );
          }}
        </ParticipantRows>
      </section>
      <section
        className="wa-message-content-group"
        aria-labelledby="wa-content-words-title"
        data-testid="wa-content-words"
      >
        <h4 id="wa-content-words-title">Words</h4>
        <p className="wa-hint">
          {count(text.eligibleWords)} eligible words. Top words need 2–40 code
          points, at least two occurrences and exclusion from the combined
          Turkish, German and English stopword set. URLs, email addresses and
          structural markers are removed. No language is inferred.
        </p>
        <ParticipantRows participants={text.participants} kind="words">
          {(participant) => (
            <>
              <p className="wa-hint">
                {count(participant.eligibleWords)} eligible words for this
                exported label.
              </p>
              <h5>Top words for this label</h5>
              <WordList
                words={participant.words}
                label={`${participant.displayName}: top words and counts`}
              />
              <h5>Words used disproportionately often</h5>
              <ComparedWords comparison={participant.comparison} />
            </>
          )}
        </ParticipantRows>
      </section>
      <ContentMethodology />
    </section>
  );
}
