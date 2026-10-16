"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { ActionButton, ActionLink } from "@/components/actions";
import type {
  WhatsAppAnalysis,
  WhatsAppCountBucket,
  WhatsAppDataset,
} from "@/lib/whatsapp";
import {
  analyzeFilteredWhatsApp,
  DEFAULT_WHATSAPP_FILTERS,
  getWhatsAppFilterOptions,
  type WhatsAppAnalysisFilters as AnalysisFilters,
  type WhatsAppFilteredAnalysis,
} from "@/lib/whatsapp/filters";
import {
  whatsappDate,
  whatsappNumber,
  whatsappPeaks,
} from "@/lib/whatsapp/stories";
import { WhatsAppAnalysisFilters } from "./analysis-filters";
import { WhatsAppActivityHeatmap } from "./activity-heatmap";
import { WhatsAppRhythm } from "./rhythm";
import { WhatsAppMessageContent } from "./message-content";

const CHART_PAGE_SIZE = 24;
const monthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const monthLabel = (bucket: WhatsAppCountBucket) =>
  monthFormatter.format(new Date(`${bucket.key}-01T12:00:00Z`));

function BarChart({
  buckets,
  label,
  shortLabels = false,
  formatLabel,
}: {
  buckets: readonly WhatsAppCountBucket[];
  label: string;
  shortLabels?: boolean;
  formatLabel?: (bucket: WhatsAppCountBucket) => string;
}) {
  const [selectedPage, setSelectedPage] = useState(0);
  const lastPage = Math.max(0, Math.ceil(buckets.length / CHART_PAGE_SIZE) - 1);
  const page = Math.min(selectedPage, lastPage);
  const start = page * CHART_PAGE_SIZE;
  const visibleBuckets = buckets
    .slice(start, start + CHART_PAGE_SIZE)
    .map((bucket) => ({
      ...bucket,
      label: formatLabel?.(bucket) ?? bucket.label,
    }));
  const maximum = useMemo(
    () => buckets.reduce((value, bucket) => Math.max(value, bucket.count), 0),
    [buckets],
  );
  const range = `Showing ${whatsappNumber(start + 1)}–${whatsappNumber(start + visibleBuckets.length)} of ${whatsappNumber(buckets.length)} values`;
  return (
    <div className="wa-chart">
      <div
        className="wa-chart-bars"
        role="img"
        aria-label={lastPage ? `${label}; ${range}` : label}
        style={{ "--wa-chart-count": visibleBuckets.length } as CSSProperties}
      >
        {visibleBuckets.map((bucket) => (
          <div
            className="wa-chart-column"
            key={bucket.key}
            title={`${bucket.label}: ${whatsappNumber(bucket.count)} messages`}
          >
            <span className="wa-chart-count">
              {whatsappNumber(bucket.count)}
            </span>
            <div className="wa-chart-track">
              <i
                style={{
                  height: `${maximum ? (bucket.count / maximum) * 100 : 0}%`,
                }}
              />
            </div>
            <span className="wa-chart-label">
              {shortLabels ? bucket.label.slice(0, 3) : bucket.label}
            </span>
          </div>
        ))}
      </div>
      {lastPage > 0 && (
        <div className="wa-chart-pagination">
          <ActionButton
            disabled={page === 0}
            onClick={() => setSelectedPage(page - 1)}
          >
            Previous values
          </ActionButton>
          <span aria-live="polite">{range}</span>
          <ActionButton
            disabled={page === lastPage}
            onClick={() => setSelectedPage(page + 1)}
          >
            Next values
          </ActionButton>
        </div>
      )}
      <details className="wa-chart-data">
        <summary>Read chart values</summary>
        <ul>
          {visibleBuckets.map((bucket) => (
            <li key={bucket.key}>
              <span>{bucket.label}</span>
              <strong>{whatsappNumber(bucket.count)}</strong>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function ActivityCalendar({ analysis }: { analysis: WhatsAppAnalysis }) {
  const months = useMemo(() => {
    if (!analysis.first || !analysis.latest) return [];
    const values: string[] = [];
    let year = analysis.first.year;
    let month = analysis.first.month;
    while (
      year < analysis.latest.year ||
      (year === analysis.latest.year && month <= analysis.latest.month)
    ) {
      values.push(`${year}-${String(month).padStart(2, "0")}`);
      if (month === 12) {
        year++;
        month = 1;
      } else month++;
    }
    return values;
  }, [analysis]);
  const [selected, setSelected] = useState(months.length - 1);
  const index = Math.max(0, Math.min(selected, months.length - 1));
  const monthKey = months[index];
  const daily = useMemo(
    () => new Map(analysis.daily.map((bucket) => [bucket.key, bucket.count])),
    [analysis],
  );
  if (!monthKey) return null;
  const [year, month] = monthKey.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const offset = (start.getUTCDay() + 6) % 7;
  const length = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthLabel = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(start);
  const maximum = analysis.daily.reduce(
    (value, bucket) => Math.max(value, bucket.count),
    0,
  );
  const days = Array.from({ length }, (_, day) => {
    const date = `${monthKey}-${String(day + 1).padStart(2, "0")}`;
    const count = daily.get(date) ?? 0;
    return { date, day: day + 1, count };
  });
  return (
    <section
      className="wa-panel wa-calendar-panel"
      aria-labelledby="wa-calendar-title"
    >
      <div className="wa-panel-heading">
        <div>
          <span className="wa-eyebrow">THE DATES WITH SOMETHING TO SAY</span>
          <h3 id="wa-calendar-title">Activity calendar</h3>
        </div>
        <div className="wa-calendar-controls">
          <ActionButton
            disabled={index === 0}
            onClick={() => setSelected(index - 1)}
            aria-label="Previous calendar month"
          >
            ←
          </ActionButton>
          <ActionButton
            disabled={index === months.length - 1}
            onClick={() => setSelected(index + 1)}
            aria-label="Next calendar month"
          >
            →
          </ActionButton>
        </div>
      </div>
      <p className="wa-calendar-month" aria-live="polite">
        {monthLabel}
      </p>
      <div
        className="wa-calendar"
        role="grid"
        aria-label={`Messages by date in ${monthLabel}`}
      >
        <div className="wa-calendar-week" role="row">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <span role="columnheader" key={day}>
              {day}
            </span>
          ))}
        </div>
        {Array.from({ length: Math.ceil((offset + length) / 7) }, (_, week) => (
          <div className="wa-calendar-week" role="row" key={week}>
            {Array.from({ length: 7 }, (_, weekday) => {
              const day = days[week * 7 + weekday - offset];
              return day ? (
                <div
                  role="gridcell"
                  tabIndex={0}
                  key={weekday}
                  className={`wa-calendar-day${day.count ? " is-active" : ""}`}
                  style={
                    {
                      "--wa-intensity": day.count
                        ? 0.2 + (day.count / maximum) * 0.65
                        : 0,
                    } as CSSProperties
                  }
                  aria-label={`${whatsappDate(day.date)}: ${whatsappNumber(day.count)} exported messages`}
                  title={`${whatsappDate(day.date)}: ${whatsappNumber(day.count)} messages`}
                >
                  <span>{day.day}</span>
                  <small>{day.count ? whatsappNumber(day.count) : "·"}</small>
                </div>
              ) : (
                <div
                  role="gridcell"
                  aria-hidden="true"
                  className="wa-calendar-empty"
                  key={weekday}
                />
              );
            })}
          </div>
        ))}
      </div>
      <p className="wa-hint">
        Brighter cells contain more selected exported messages. An empty date
        means no participant messages match the current filters on that date.
      </p>
    </section>
  );
}

export function WhatsAppAnalyzer({
  dataset,
  analysis: sourceAnalysis,
}: {
  dataset: WhatsAppDataset;
  analysis: WhatsAppAnalysis;
}) {
  const [filters, setFilters] = useState<AnalysisFilters>(
    DEFAULT_WHATSAPP_FILTERS,
  );
  const options = useMemo(() => getWhatsAppFilterOptions(dataset), [dataset]);
  const result = useMemo(
    () => analyzeFilteredWhatsApp(dataset, filters),
    [dataset, filters],
  );
  return (
    <div className="wa-analysis" aria-label="Chat analysis results">
      <div className="wa-results-heading">
        <div>
          <span className="wa-eyebrow">THE CONVERSATION, IN PERSPECTIVE</span>
          <h2>Here&apos;s what your export says.</h2>
          <p>
            Loaded export: {whatsappNumber(sourceAnalysis.totals.messages)}{" "}
            messages
            {sourceAnalysis.first &&
              sourceAnalysis.latest &&
              ` · ${whatsappDate(sourceAnalysis.first.date)} – ${whatsappDate(sourceAnalysis.latest.date)}`}
            . Recorded times, without an inferred timezone.
          </p>
        </div>
        <ActionLink variant="primary" href="/whatsapp/wrapped/">
          Make your Wrapped <span aria-hidden="true">↗</span>
        </ActionLink>
      </div>
      <WhatsAppAnalysisFilters
        filters={filters}
        options={options}
        firstDate={sourceAnalysis.first?.date ?? ""}
        latestDate={sourceAnalysis.latest?.date ?? ""}
        onChange={setFilters}
      />
      {result.ok ? (
        <WhatsAppAnalyzerResults
          key={JSON.stringify(filters)}
          dataset={dataset}
          result={result}
          sourceMessageCount={sourceAnalysis.totals.messages}
        />
      ) : (
        <p className="wa-filter-error" role="alert">
          {result.error} No filtered results are shown until the selection is
          valid.
        </p>
      )}
    </div>
  );
}

function WhatsAppAnalyzerResults({
  dataset,
  result,
  sourceMessageCount,
}: {
  dataset: WhatsAppDataset;
  result: Extract<WhatsAppFilteredAnalysis, { ok: true }>;
  sourceMessageCount: number;
}) {
  const { analysis, heatmap, overview, participant } = result;
  const [participantPage, setParticipantPage] = useState(0);
  const [allMonths, setAllMonths] = useState(false);
  const group = dataset.participants.length > 2;
  const participants = useMemo(
    () =>
      [...analysis.participants].sort(
        (a, b) =>
          b.messageCount - a.messageCount ||
          // Stable source order breaks group ties without locale collation.
          (group ? 0 : a.displayName.localeCompare(b.displayName)),
      ),
    [analysis, group],
  );
  const countRanks = useMemo(() => {
    const counts = new Map<number, { rank: number; labels: number }>();
    participants.forEach((participant, index) => {
      const count = counts.get(participant.messageCount);
      if (count) count.labels++;
      else counts.set(participant.messageCount, { rank: index + 1, labels: 1 });
    });
    return counts;
  }, [participants]);
  const visibleParticipants = participants.slice(
    participantPage * 8,
    (participantPage + 1) * 8,
  );
  const maximum = participants[0]?.messageCount ?? 0;
  const dailyPeaks = whatsappPeaks(analysis.daily);
  const hourPeaks = whatsappPeaks(analysis.hours);
  const months = allMonths ? analysis.monthly : analysis.monthly.slice(-12);
  const demo = dataset.metadata.source === "demo";
  const span = analysis.observedSpanSeconds;
  const displayedSpan = `${whatsappNumber(Math.floor(span / 86400))} d ${Math.floor((span % 86400) / 3600)} h ${Math.floor((span % 3600) / 60)} min${dataset.metadata.timestampPrecision !== "minute" ? ` ${span % 60} s` : ""}`;
  return (
    <>
      <section
        className="wa-filtered-overview"
        aria-label="Filtered chat overview"
      >
        <h3>Filtered overview</h3>
        <p>
          {whatsappNumber(analysis.totals.messages)} of{" "}
          {whatsappNumber(sourceMessageCount)} exported participant messages
          match.
          {participant && (
            <>
              {" "}
              Figures describe messages and recognized events attributable to
              the exported label <strong>{participant.displayName}</strong>.
              Senderless system events are excluded because their participant is
              unknown.
            </>
          )}
        </p>
        <div className="wa-stat-grid">
          <div className="wa-stat wa-stat-featured">
            <span>Exported messages</span>
            <strong>{whatsappNumber(analysis.totals.messages)}</strong>
            <small>Participant messages matching the filters</small>
          </div>
          <div className="wa-stat">
            <span>Active dates</span>
            <strong>{whatsappNumber(analysis.totals.activeDays)}</strong>
            <small>Dates with at least one matching message</small>
          </div>
          <div className="wa-stat">
            <span>Messages per active date</span>
            <strong
              className={
                overview.messagesPerActiveDate === null
                  ? "wa-stat-unavailable"
                  : undefined
              }
            >
              {overview.messagesPerActiveDate === null
                ? "Unavailable"
                : whatsappNumber(overview.messagesPerActiveDate)}
            </strong>
            <small>Matching messages ÷ their active dates</small>
          </div>
          <div className="wa-stat">
            <span>Recognized media messages</span>
            <strong>{whatsappNumber(analysis.totals.mediaMessages)}</strong>
            <small>Supported text markers; attachments are not inspected</small>
          </div>
          <div className="wa-stat">
            <span>Link occurrences</span>
            <strong>{whatsappNumber(analysis.totals.links)}</strong>
            <small>HTTP(S) links in matching participant messages</small>
          </div>
          <div className="wa-stat">
            <span>Recognized call events</span>
            <strong>{whatsappNumber(overview.recognizedCallEvents)}</strong>
            <small>
              {participant
                ? "Supported call markers in this label’s messages only"
                : `${whatsappNumber(overview.attributedCallEvents)} sender-labelled markers; ${whatsappNumber(overview.unattributedCallEvents)} senderless system markers`}
            </small>
          </div>
          <div className="wa-stat">
            <span>Participants</span>
            <strong>{whatsappNumber(analysis.totals.participants)}</strong>
            <small>Sender labels with matching messages</small>
          </div>
          <div className="wa-stat">
            <span>Calendar days covered</span>
            <strong>{whatsappNumber(analysis.calendarSpanDays)}</strong>
            <small>From first to latest matching message, inclusive</small>
          </div>
        </div>
      </section>
      {!analysis.totals.messages && (
        <div className="wa-filter-empty" role="status">
          <h3>No exported messages match these filters.</h3>
          <p>
            Choose another date or participant, or reset filters to see the full
            export. Senderless system events may still match Everyone; they do
            not count as participant messages.
          </p>
        </div>
      )}
      <div className="wa-evidence-note">
        <span aria-hidden="true">↳</span>
        <p>
          {demo ? "These results use fictional demo data. " : ""}This export is
          a record of included messages. It cannot prove who read a message, how
          anyone felt, or whether the chat history is complete.
        </p>
      </div>
      <div className="wa-analysis-grid">
        <section
          className="wa-panel wa-recorded-span"
          aria-labelledby="wa-recorded-span-title"
        >
          <div className="wa-panel-heading">
            <div>
              <span className="wa-eyebrow">
                THE DATES AND CLOCK VALUES IN YOUR FILE
              </span>
              <h3 id="wa-recorded-span-title">Recorded range</h3>
            </div>
            <span className="wa-panel-badge">
              Source:{" "}
              {dataset.metadata.timestampPrecision === "mixed"
                ? "Mixed minute / second precision"
                : `${dataset.metadata.timestampPrecision} precision`}
            </span>
          </div>
          <dl className="wa-recorded-times">
            <div>
              <dt>Earliest selected exported message</dt>
              <dd>
                {analysis.first?.local.replace("T", " · ") ?? "Unavailable"}
              </dd>
            </div>
            <div>
              <dt>Latest selected exported message</dt>
              <dd>
                {analysis.latest?.local.replace("T", " · ") ?? "Unavailable"}
              </dd>
            </div>
            <div>
              <dt>Observed span in written clock values</dt>
              <dd>
                {analysis.first && analysis.latest
                  ? displayedSpan
                  : "Unavailable"}
              </dd>
            </div>
          </dl>
          <p className="wa-hint">
            These are the numeric dates and times recorded in the export,
            without message contents. No timezone or daylight-saving adjustment
            is inferred; the span is a wall-clock comparison.
          </p>
        </section>
        <section
          className="wa-panel wa-participants"
          aria-labelledby="wa-participants-title"
        >
          <div className="wa-panel-heading">
            <div>
              <span className="wa-eyebrow">EVERY CONTRIBUTION COUNTS</span>
              <h3 id="wa-participants-title">Messages by participant</h3>
            </div>
            <span className="wa-panel-badge">
              {whatsappNumber(participants.length)} labels
            </span>
          </div>
          <p>
            Message counts and each participant&apos;s share of the selected
            exported messages.
          </p>
          {group && participants.length > 0 && (
            <p className="wa-hint" aria-live="polite">
              Highest counts first; equal counts retain accepted label order.
              {participants.length > 8 ? (
                <>
                  {" "}
                  Showing {whatsappNumber(participantPage * 8 + 1)}–
                  {whatsappNumber(
                    Math.min((participantPage + 1) * 8, participants.length),
                  )}{" "}
                  of {whatsappNumber(participants.length)} labels;{" "}
                  {whatsappNumber(
                    participants.length - visibleParticipants.length,
                  )}{" "}
                  additional labels not displayed on this page.
                </>
              ) : (
                <> All {whatsappNumber(participants.length)} labels shown.</>
              )}{" "}
              Shares include all selected messages, including labels on other
              pages. Rounded shares may not total 100%.
            </p>
          )}
          <div className="wa-participant-bars">
            {visibleParticipants.map((participant, position) => (
              <div className="wa-participant-row" key={participant.id}>
                <div className="wa-participant-label">
                  <span className="wa-participant-avatar" aria-hidden="true">
                    {String(
                      group
                        ? countRanks.get(participant.messageCount)!.rank
                        : participantPage * 8 + position + 1,
                    ).padStart(2, "0")}
                  </span>
                  <span title={participant.displayName}>
                    {participant.displayName}
                  </span>
                  <strong>
                    {whatsappNumber(participant.messageCount)}{" "}
                    <small>
                      {analysis.totals.messages
                        ? (
                            (participant.messageCount /
                              analysis.totals.messages) *
                            100
                          ).toFixed(1)
                        : "0"}
                      %
                    </small>
                  </strong>
                </div>
                <div className="wa-participant-track" aria-hidden="true">
                  <i
                    style={{
                      width: `${maximum ? (participant.messageCount / maximum) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p className="wa-participant-extras">
                  {group &&
                    countRanks.get(participant.messageCount)!.labels > 1 && (
                      <>
                        {whatsappNumber(
                          countRanks.get(participant.messageCount)!.labels,
                        )}{" "}
                        labels tied at this count ·{" "}
                      </>
                    )}
                  Media markers: {whatsappNumber(participant.mediaMessages)} ·
                  Links: {whatsappNumber(participant.links)} · Emoji:{" "}
                  {participant.emoji === null
                    ? "unavailable"
                    : whatsappNumber(participant.emoji)}
                </p>
              </div>
            ))}
          </div>
          {participants.length > 8 && (
            <div className="wa-participant-pagination">
              <ActionButton
                disabled={participantPage === 0}
                onClick={() => setParticipantPage(participantPage - 1)}
              >
                Previous participants
              </ActionButton>
              <span aria-live="polite">
                {participantPage * 8 + 1}–
                {Math.min((participantPage + 1) * 8, participants.length)} of{" "}
                {whatsappNumber(participants.length)}
              </span>
              <ActionButton
                disabled={(participantPage + 1) * 8 >= participants.length}
                onClick={() => setParticipantPage(participantPage + 1)}
              >
                Next participants
              </ActionButton>
            </div>
          )}
          <p className="wa-hint">
            Sender labels come from the file and may not uniquely identify a
            person. Shares use only the filtered subset; selecting one label
            does not describe their share of the whole conversation. Equal
            counts are tied. Media, links and emoji use the same supported text
            counts as the totals.
          </p>
        </section>
        <ActivityCalendar analysis={analysis} />
        <section
          className="wa-panel wa-years-panel"
          aria-labelledby="wa-years-title"
        >
          <div className="wa-panel-heading">
            <div>
              <span className="wa-eyebrow">THE YEARS IN THIS EXPORT</span>
              <h3 id="wa-years-title">Messages by year</h3>
            </div>
          </div>
          <p>
            Message counts for each recorded calendar year. A year may contain
            only part of the conversation.
          </p>
          <BarChart
            buckets={analysis.yearly}
            label="Number of exported messages in each recorded year"
          />
        </section>
        <section
          className="wa-panel wa-months-panel"
          aria-labelledby="wa-months-title"
        >
          <div className="wa-panel-heading">
            <div>
              <span className="wa-eyebrow">
                HOW THE CHAT MOVES THROUGH TIME
              </span>
              <h3 id="wa-months-title">Messages by month</h3>
            </div>
            {analysis.monthly.length > 12 && (
              <ActionButton
                variant="tertiary"
                onClick={() => setAllMonths(!allMonths)}
              >
                {allMonths ? "Latest 12 months" : "All recorded months"}
              </ActionButton>
            )}
          </div>
          <p>
            {!allMonths && analysis.monthly.length > 12
              ? `Latest 12 of ${whatsappNumber(analysis.monthly.length)} recorded months.`
              : "Recorded months with exported messages."}{" "}
            This is message activity, rather than a complete history of the
            chat.
          </p>
          <BarChart
            key={allMonths ? "all-months" : "latest-months"}
            buckets={months}
            formatLabel={monthLabel}
            label="Number of exported messages in each recorded month"
          />
        </section>
        <section
          className="wa-panel wa-hours-panel"
          aria-labelledby="wa-hours-title"
        >
          <div className="wa-panel-heading">
            <div>
              <span className="wa-eyebrow">AROUND THE CLOCK</span>
              <h3 id="wa-hours-title">Time of day</h3>
            </div>
          </div>
          <p>
            Selected exported dates, grouped by the hour written in the file.
          </p>
          <BarChart
            buckets={analysis.hours.map((bucket) => ({
              ...bucket,
              label: `${bucket.key.padStart(2, "0")}:00`,
            }))}
            label="Number of exported messages in each hourly bucket"
          />
          <p className="wa-chart-takeaway">
            {hourPeaks.length === 1
              ? `${hourPeaks[0].label} has the highest count: ${whatsappNumber(hourPeaks[0].count)} messages.`
              : hourPeaks.length
                ? `${whatsappNumber(hourPeaks.length)} hourly buckets tie at ${whatsappNumber(hourPeaks[0].count)} messages each.`
                : "No hourly activity is available."}
          </p>
        </section>
        <section className="wa-panel" aria-labelledby="wa-weekdays-title">
          <div className="wa-panel-heading">
            <div>
              <span className="wa-eyebrow">A WEEK, ADDED UP</span>
              <h3 id="wa-weekdays-title">Days of the week</h3>
            </div>
          </div>
          <p>Selected message counts by recorded calendar weekday.</p>
          <BarChart
            buckets={analysis.weekdays}
            label="Number of exported messages on each weekday"
            shortLabels
          />
        </section>
        <WhatsAppActivityHeatmap counts={heatmap} />
        <section
          className="wa-panel wa-content-panel"
          aria-labelledby="wa-extras-title"
        >
          <div className="wa-panel-heading">
            <div>
              <span className="wa-eyebrow">MORE IN THE TEXT</span>
              <h3 id="wa-extras-title">The extras</h3>
            </div>
          </div>
          <dl className="wa-extra-counts">
            <div>
              <dt>Messages containing links</dt>
              <dd>{whatsappNumber(analysis.totals.messagesWithLinks)}</dd>
            </div>
            <div>
              <dt>Supported emoji occurrences</dt>
              <dd>
                {analysis.totals.emoji === null
                  ? "Unavailable"
                  : whatsappNumber(analysis.totals.emoji)}
              </dd>
            </div>
            <div>
              <dt>Recorded system events</dt>
              <dd>{whatsappNumber(analysis.totals.systemEvents)}</dd>
            </div>
          </dl>
          <p className="wa-hint">
            Media counts rely on supported text markers. Attachments are not
            inspected. Emoji counts cover supported graphemes. System events are
            excluded from message charts.
          </p>
        </section>
        <section
          className="wa-panel wa-small-facts"
          aria-labelledby="wa-small-facts-title"
        >
          <span className="wa-eyebrow">SMALL FACTS, CLEAR LIMITS</span>
          <h3 id="wa-small-facts-title">A few recorded high points</h3>
          <dl>
            <div>
              <dt>
                {dailyPeaks.length === 1
                  ? "Highest message count on a date"
                  : "Highest message count, tied dates"}
              </dt>
              <dd>
                {dailyPeaks.length
                  ? `${whatsappNumber(dailyPeaks[0].count)} messages${dailyPeaks.length > 1 ? ` on each of ${whatsappNumber(dailyPeaks.length)} dates` : ` on ${whatsappDate(dailyPeaks[0].key, true)}`}`
                  : "Unavailable"}
              </dd>
            </div>
            <div>
              <dt>
                {participant
                  ? "Longest consecutive run of this participant’s active dates"
                  : "Longest consecutive run of active dates"}
              </dt>
              <dd>
                {analysis.longestStreak
                  ? `${whatsappNumber(analysis.longestStreak.days)} dates · ${whatsappDate(analysis.longestStreak.from, true)} – ${whatsappDate(analysis.longestStreak.to, true)}`
                  : "Unavailable"}
              </dd>
            </div>
            <div>
              <dt>
                {participant
                  ? "Longest recorded interval between this participant’s messages"
                  : "Longest recorded interval between messages"}
              </dt>
              <dd>
                {analysis.longestGap
                  ? `${whatsappNumber(Math.floor(analysis.longestGap.wallClockSeconds / 3600))} h ${Math.floor((analysis.longestGap.wallClockSeconds % 3600) / 60)} min${dataset.metadata.timestampPrecision !== "minute" ? ` ${analysis.longestGap.wallClockSeconds % 60} s` : ""}`
                  : "No interval to measure"}
              </dd>
            </div>
          </dl>
          <p className="wa-hint">
            {participant
              ? `These runs and intervals describe only the selected label ${participant.displayName}’s matching messages, not conversation silence or other participants’ activity. `
              : "Runs and intervals use only the participant messages matching the date filter, not proof of conversation silence. "}
            Intervals compare the wall-clock values in the export. Timezone and
            daylight-saving changes are unknown. Several runs or intervals may
            share the same maximum.
          </p>
        </section>
      </div>
      <WhatsAppRhythm
        result={result.rhythm}
        precision={dataset.metadata.timestampPrecision}
      />
      <WhatsAppMessageContent
        result={result.content}
        participantSelected={participant !== null}
      />
    </>
  );
}
