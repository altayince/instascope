"use client";

import { useMemo, useState } from "react";
import { ActionButton } from "@/components/actions";
import {
  RAPID_TRANSITION_MINUTES,
  SESSION_GAP_MINUTES,
  SILENCE_BREAK_HOURS,
} from "@/lib/whatsapp/rhythm";
import type {
  WhatsAppConversationRhythm,
  WhatsAppDelayBucket,
  WhatsAppParticipantRhythm,
  WhatsAppRhythmResult,
} from "@/lib/whatsapp/rhythm-types";
import type { WhatsAppDataset } from "@/lib/whatsapp/types";
import { whatsappNumber } from "@/lib/whatsapp/stories";

const PARTICIPANT_PAGE_SIZE = 8;
const shareFormatter = new Intl.NumberFormat("en-GB", {
  style: "percent",
  maximumFractionDigits: 1,
});

/** Presentation only: preserve fractional seconds produced by quantiles. */
function duration(seconds: number | null) {
  if (seconds === null) return "Unavailable";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return [
    days ? `${whatsappNumber(days)} d` : "",
    hours ? `${hours} h` : "",
    minutes ? `${minutes} min` : "",
    remainingSeconds || seconds === 0
      ? `${whatsappNumber(remainingSeconds)} s`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

type ParticipantMetric = {
  label: string;
  value: (participant: WhatsAppParticipantRhythm) => number | null;
  format: (value: number | null) => string;
};

const count = (value: number | null) =>
  value === null ? "Unavailable" : whatsappNumber(value);
const participantMetrics: ParticipantMetric[] = [
  {
    label: "Started recorded sessions",
    value: (participant) => participant.sessionsStarted,
    format: count,
  },
  {
    label: "Silence breakers",
    value: (participant) => participant.silenceBreakers,
    format: count,
  },
  {
    label: "Next-sender transitions",
    value: (participant) => participant.timing.count,
    format: count,
  },
  {
    label: "Median delay",
    value: (participant) => participant.timing.medianSeconds,
    format: duration,
  },
  {
    label: "P25 delay",
    value: (participant) => participant.timing.p25Seconds,
    format: duration,
  },
  {
    label: "P75 delay",
    value: (participant) => participant.timing.p75Seconds,
    format: duration,
  },
  {
    label: "Rapid transitions",
    value: (participant) => participant.rapidTransitions,
    format: count,
  },
  {
    label: "Rapid share",
    value: (participant) => participant.rapidShare,
    format: (value) =>
      value === null ? "Unavailable" : shareFormatter.format(value),
  },
];

function DelayCounts({
  buckets,
  label,
  bars = false,
}: {
  buckets: readonly WhatsAppDelayBucket[];
  label: string;
  bars?: boolean;
}) {
  const maximum = Math.max(0, ...buckets.map((bucket) => bucket.count));
  return (
    <ul
      className={`wa-rhythm-delay-counts${bars ? " has-bars" : ""}`}
      aria-label={label}
    >
      {buckets.map((bucket) => (
        <li key={bucket.key}>
          <span>{bucket.label}</span>
          <strong>{whatsappNumber(bucket.count)}</strong>
          {bars && (
            <div className="wa-rhythm-delay-track" aria-hidden="true">
              <i
                style={{
                  width: `${maximum ? (bucket.count / maximum) * 100 : 0}%`,
                }}
              />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function RhythmMethodology() {
  return (
    <details className="wa-rhythm-methodology">
      <summary>How Rhythm &amp; Dynamics is calculated</summary>
      <dl className="wa-rhythm-truth">
        <div>
          <dt>Exact under the accepted-record definitions</dt>
          <dd>
            Participant transition counts and session starter labels come from
            adjacent accepted participant records. Exported labels are not
            verified identities.
          </dd>
        </div>
        <div>
          <dt>Derived</dt>
          <dd>
            Sessions, silence breakers, rapid transitions, durations and delay
            summaries apply the definitions below to the supplied records.
          </dd>
        </div>
        <div>
          <dt>Unavailable</dt>
          <dd>
            Real replies, read or seen times, attention, intent and relationship
            interpretations are unavailable from supported exports.
          </dd>
        </div>
      </dl>
      <ul>
        <li>
          Sessions use participant messages sorted by accepted recorded
          timestamp. A new session starts only when the preceding gap is greater
          than {SESSION_GAP_MINUTES} minutes. System events are ignored; they
          neither create nor split sessions. The first label in each session is
          its recorded starter.
        </li>
        <li>
          A silence breaker requires a previous participant message and a
          recorded gap of at least {SILENCE_BREAK_HOURS} hours. It identifies
          the next sender after that interval. No participant message exists in
          the supplied export during that recorded interval; this does not prove
          nobody communicated elsewhere or that the export is complete.
        </li>
        <li>
          A participant transition is a change of exported label between two
          consecutive participant messages. Next-message timing after another
          participant measures the next sender&apos;s recorded delay, including
          transitions across session boundaries. Adjacency does not verify a
          reply or imply causality, read time or intent.
        </li>
        <li>
          Delay buckets are under 1 minute; 1 minute to under{" "}
          {RAPID_TRANSITION_MINUTES} minutes; {RAPID_TRANSITION_MINUTES} minutes
          to under {SESSION_GAP_MINUTES} minutes; {SESSION_GAP_MINUTES} minutes
          to under {SILENCE_BREAK_HOURS} hours; and {SILENCE_BREAK_HOURS} hours
          or more. Each transition belongs to one bucket.
        </li>
        <li>
          Rapid transitions require a participant change, a delay of at most{" "}
          {RAPID_TRANSITION_MINUTES} minutes and both messages inside the same{" "}
          {SESSION_GAP_MINUTES}-minute session. These thresholds are product
          definitions. Rapid share divides a label&apos;s rapid transitions by
          all its observed next-sender transitions; it is unavailable with none.
          Displayed shares are rounded to one decimal place.
        </li>
        <li>
          All durations compare recorded wall-clock values. No timezone or
          daylight-saving correction is inferred. Equal timestamps follow the
          deterministic accepted export order; that order does not prove the
          real sequence of events.
        </li>
        <li>
          Date filters recompute dynamics inside the selected date subset. Its
          first participant message counts as a session starter, with no
          predecessor outside the subset and no inferred silence breaker.
          Conversation-relative dynamics are unavailable when one participant is
          selected; select Everyone to calculate them.
        </li>
        <li>
          Median, p25 and p75 sort observed values and use linear interpolation
          at rank (n - 1) × p, where p is 0.5, 0.25 or 0.75. They are derived
          summaries; an interpolated value need not be an observed event time.
          Equal values are ties. Empty observations have exact zero counts and
          unavailable medians, spans and shares.
        </li>
      </ul>
    </details>
  );
}

function ParticipantRhythm({
  participants,
}: {
  participants: readonly WhatsAppParticipantRhythm[];
}) {
  const [selectedPage, setSelectedPage] = useState(0);
  const lastPage = Math.max(
    0,
    Math.ceil(participants.length / PARTICIPANT_PAGE_SIZE) - 1,
  );
  const page = Math.min(selectedPage, lastPage);
  const start = page * PARTICIPANT_PAGE_SIZE;
  const visible = participants.slice(start, start + PARTICIPANT_PAGE_SIZE);
  const ties = useMemo(
    () =>
      participantMetrics.map((metric) => {
        const counts = new Map<number, number>();
        for (const participant of participants) {
          const value = metric.value(participant);
          if (value !== null) counts.set(value, (counts.get(value) ?? 0) + 1);
        }
        return counts;
      }),
    [participants],
  );
  if (!participants.length)
    return (
      <p className="wa-hint">
        No participant rhythm rows are available without matching participant
        messages.
      </p>
    );
  return (
    <div className="wa-rhythm-participants">
      <h4>Recorded session starters and next senders</h4>
      <p className="wa-hint">
        Next-message timing after another participant describes each label as
        the next sender. Labels retain their accepted participant order. Equal
        values are marked as ties across all matching labels, including other
        pages; unavailable values have no comparison. On narrow screens, scroll
        the table to read every metric.
      </p>
      <div
        className="wa-rhythm-table-scroll"
        role="region"
        aria-label="Participant rhythm table; scroll to read all columns"
        tabIndex={0}
      >
        <table className="wa-rhythm-table">
          <caption>Participant rhythm in the selected dates</caption>
          <thead>
            <tr>
              <th scope="col">Exported participant label</th>
              {participantMetrics.map((metric) => (
                <th scope="col" key={metric.label}>
                  {metric.label}
                </th>
              ))}
              <th scope="col">Delay distribution</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((participant) => (
              <tr key={participant.id}>
                <th scope="row">{participant.displayName}</th>
                {participantMetrics.map((metric, index) => {
                  const value = metric.value(participant);
                  const tied =
                    value !== null && (ties[index].get(value) ?? 0) > 1;
                  const display = metric.format(value);
                  return (
                    <td
                      key={metric.label}
                      aria-label={`${participant.displayName}: ${metric.label}: ${display}${tied ? " (tied)" : ""}`}
                    >
                      {display}
                      {tied && <small> (tied)</small>}
                    </td>
                  );
                })}
                <td>
                  <details className="wa-rhythm-participant-buckets">
                    <summary>Read delay counts</summary>
                    <DelayCounts
                      buckets={participant.timing.buckets}
                      label={`${participant.displayName}: transition delay counts`}
                    />
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {lastPage > 0 && (
        <div className="wa-rhythm-pagination">
          <ActionButton
            disabled={page === 0}
            onClick={() => setSelectedPage(page - 1)}
          >
            Previous rhythm participants
          </ActionButton>
          <span aria-live="polite">
            {whatsappNumber(start + 1)}–{whatsappNumber(start + visible.length)}{" "}
            of {whatsappNumber(participants.length)} labels
          </span>
          <ActionButton
            disabled={page === lastPage}
            onClick={() => setSelectedPage(page + 1)}
          >
            Next rhythm participants
          </ActionButton>
        </div>
      )}
    </div>
  );
}

function RhythmResults({ analysis }: { analysis: WhatsAppConversationRhythm }) {
  const { sessionSummary, silenceSummary, timing } = analysis;
  const longestMessages = sessionSummary.longestByMessages;
  const longestSpan = sessionSummary.longestBySpan;
  return (
    <>
      <p>
        Participant messages in the selected dates, with Everyone included.
        Sessions and delays describe the supplied export&apos;s recorded
        wall-clock values.
      </p>
      {!analysis.messageCount && (
        <p className="wa-hint" role="status">
          No participant messages match the selected dates. Counts are zero;
          duration summaries and shares are unavailable.
        </p>
      )}
      <div className="wa-rhythm-summaries">
        <div>
          <h4>Conversation sessions</h4>
          <dl>
            <div>
              <dt>Recorded sessions</dt>
              <dd>{whatsappNumber(sessionSummary.total)}</dd>
            </div>
            <div>
              <dt>Median messages per session</dt>
              <dd>{count(sessionSummary.medianMessages)}</dd>
            </div>
            <div>
              <dt>Longest session by messages</dt>
              <dd>
                {longestMessages
                  ? `${whatsappNumber(longestMessages.messageCount)} ${longestMessages.messageCount === 1 ? "message" : "messages"}${longestMessages.tiedSessions > 1 ? ` · ${whatsappNumber(longestMessages.tiedSessions)} tied sessions` : ""}`
                  : "Unavailable"}
              </dd>
            </div>
            <div>
              <dt>Longest session by recorded span</dt>
              <dd>
                {longestSpan
                  ? `${duration(longestSpan.spanSeconds)}${longestSpan.tiedSessions > 1 ? ` · ${whatsappNumber(longestSpan.tiedSessions)} tied sessions` : ""}`
                  : "Unavailable"}
              </dd>
            </div>
          </dl>
          <p className="wa-hint">
            A new session needs a gap greater than {SESSION_GAP_MINUTES} minutes
            between participant messages.
          </p>
        </div>
        <div>
          <h4>Long gaps and silence breakers</h4>
          <dl>
            <div>
              <dt>Qualifying long gaps</dt>
              <dd>{whatsappNumber(silenceSummary.total)}</dd>
            </div>
            <div>
              <dt>Median qualifying gap</dt>
              <dd>{duration(silenceSummary.medianGapSeconds)}</dd>
            </div>
            <div>
              <dt>Longest qualifying gap</dt>
              <dd>{duration(silenceSummary.longestGapSeconds)}</dd>
            </div>
          </dl>
          <p className="wa-hint">
            At least {SILENCE_BREAK_HOURS} recorded hours with no participant
            message in this export, followed by the next participant message.
            This is not proof of actual silence or complete history.
          </p>
        </div>
        <div>
          <h4>Next-message timing</h4>
          <dl>
            <div>
              <dt>Participant transitions</dt>
              <dd>{whatsappNumber(timing.count)}</dd>
            </div>
            <div>
              <dt>Median transition delay</dt>
              <dd>{duration(timing.medianSeconds)}</dd>
            </div>
            <div>
              <dt>P25 transition delay</dt>
              <dd>{duration(timing.p25Seconds)}</dd>
            </div>
            <div>
              <dt>P75 transition delay</dt>
              <dd>{duration(timing.p75Seconds)}</dd>
            </div>
            <div>
              <dt>Rapid transitions</dt>
              <dd>{whatsappNumber(analysis.rapidTransitions)}</dd>
            </div>
          </dl>
          <p className="wa-hint">
            A transition changes the adjacent sender label. Rapid transitions
            are at most {RAPID_TRANSITION_MINUTES} minutes apart inside the same
            session. Neither identifies verified replies or read times.
          </p>
        </div>
      </div>
      <div className="wa-rhythm-distribution">
        <h4>Transition delay distribution</h4>
        <p className="wa-hint">
          Counts of adjacent participant changes in each recorded delay bucket.
          All counts are shown as text as well as bars.
        </p>
        <DelayCounts
          buckets={timing.buckets}
          label="Transition delay counts"
          bars
        />
      </div>
      <ParticipantRhythm participants={analysis.participants} />
    </>
  );
}

export function WhatsAppRhythm({
  result,
  precision,
}: {
  result: WhatsAppRhythmResult;
  precision: WhatsAppDataset["metadata"]["timestampPrecision"];
}) {
  return (
    <section className="wa-panel wa-rhythm" aria-labelledby="wa-rhythm-title">
      <div className="wa-panel-heading">
        <div>
          <span className="wa-eyebrow">RECORDED PATTERNS, CLEAR LIMITS</span>
          <h3 id="wa-rhythm-title">Rhythm &amp; Dynamics</h3>
        </div>
        <span className="wa-panel-badge">Derived summaries</span>
      </div>
      {result.available ? (
        <RhythmResults analysis={result.analysis} />
      ) : (
        <div className="wa-rhythm-unavailable" role="status">
          <p>
            Conversation-relative dynamics are unavailable with one participant
            selected.
          </p>
          <p>
            Select Everyone to calculate sessions, long gaps and participant
            transitions for the selected dates.
          </p>
        </div>
      )}
      <p className="wa-hint wa-rhythm-precision">
        Source recorded timestamp precision:{" "}
        {precision === "mixed" ? "mixed minute / second" : precision}. Fractions
        in summaries come from interpolation, not more precise source
        timestamps.
      </p>
      <RhythmMethodology />
    </section>
  );
}
