"use client";

import { ActionButton } from "@/components/actions";
import {
  DEFAULT_WHATSAPP_FILTERS,
  type WhatsAppAnalysisFilters as AnalysisFilters,
  type WhatsAppDateFilter,
} from "@/lib/whatsapp/filters";
import type { WhatsAppParticipant } from "@/lib/whatsapp";

const monthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function monthName(month: string) {
  return monthFormatter.format(new Date(`${month}-01T12:00:00Z`));
}

function dateScope(date: WhatsAppDateFilter) {
  switch (date.mode) {
    case "all":
      return "All time";
    case "year":
      return String(date.year);
    case "month":
      return date.month ? monthName(date.month) : "Choose a month";
    case "range":
      return `${date.from || "Choose a start date"} – ${date.to || "Choose an end date"} (inclusive)`;
  }
}

export function WhatsAppAnalysisFilters({
  filters,
  options,
  firstDate,
  latestDate,
  onChange,
}: {
  filters: AnalysisFilters;
  options: {
    years: number[];
    months: string[];
    participants: WhatsAppParticipant[];
  };
  firstDate: string;
  latestDate: string;
  onChange: (filters: AnalysisFilters) => void;
}) {
  const active = filters.date.mode !== "all" || filters.participantId !== null;
  const participant = options.participants.find(
    (item) => item.id === filters.participantId,
  );
  function changeDate(date: WhatsAppDateFilter) {
    onChange({ ...filters, date });
  }
  function changeMode(mode: WhatsAppDateFilter["mode"]) {
    switch (mode) {
      case "all":
        changeDate({ mode });
        break;
      case "year":
        changeDate({ mode, year: options.years.at(-1) ?? 0 });
        break;
      case "month":
        changeDate({ mode, month: options.months.at(-1) ?? "" });
        break;
      case "range":
        changeDate({ mode, from: firstDate, to: latestDate });
        break;
    }
  }
  return (
    <section className="wa-analysis-filters" aria-label="Analysis filters">
      <div className="wa-filter-controls">
        <label>
          <span>Date filter</span>
          <select
            value={filters.date.mode}
            onChange={(event) =>
              changeMode(event.target.value as WhatsAppDateFilter["mode"])
            }
          >
            <option value="all">All time</option>
            <option value="year">Specific year</option>
            <option value="month">Specific month</option>
            <option value="range">Custom date range</option>
          </select>
        </label>
        {filters.date.mode === "year" && (
          <label>
            <span>Year</span>
            <select
              value={filters.date.year}
              onChange={(event) =>
                changeDate({ mode: "year", year: Number(event.target.value) })
              }
            >
              {options.years.map((year) => (
                <option value={year} key={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        )}
        {filters.date.mode === "month" && (
          <label>
            <span>Month</span>
            <select
              value={filters.date.month}
              onChange={(event) =>
                changeDate({ mode: "month", month: event.target.value })
              }
            >
              {options.months.map((month) => (
                <option value={month} key={month}>
                  {monthName(month)}
                </option>
              ))}
            </select>
          </label>
        )}
        {filters.date.mode === "range" && (
          <>
            <label>
              <span>From date</span>
              <input
                type="date"
                value={filters.date.from}
                aria-describedby="wa-filter-scope"
                onChange={(event) =>
                  changeDate({
                    mode: "range",
                    from: event.target.value,
                    to: filters.date.mode === "range" ? filters.date.to : "",
                  })
                }
              />
            </label>
            <label>
              <span>To date</span>
              <input
                type="date"
                value={filters.date.to}
                aria-describedby="wa-filter-scope"
                onChange={(event) =>
                  changeDate({
                    mode: "range",
                    from:
                      filters.date.mode === "range" ? filters.date.from : "",
                    to: event.target.value,
                  })
                }
              />
            </label>
          </>
        )}
        <label>
          <span>Participant</span>
          <select
            value={filters.participantId ?? ""}
            onChange={(event) =>
              onChange({
                ...filters,
                participantId: event.target.value || null,
              })
            }
          >
            <option value="">Everyone</option>
            {options.participants.map((item) => (
              <option value={item.id} key={item.id}>
                {item.displayName}
              </option>
            ))}
          </select>
        </label>
        <ActionButton
          onClick={() => onChange(DEFAULT_WHATSAPP_FILTERS)}
          disabled={!active}
        >
          Reset filters
        </ActionButton>
      </div>
      <p id="wa-filter-scope" role="status" className="wa-filter-scope">
        <strong>{active ? "Active filters" : "Showing"}:</strong>{" "}
        {dateScope(filters.date)} · {participant?.displayName ?? "Everyone"}
      </p>
      <p className="wa-hint">
        Filters apply to Chat Analyzer only. The loaded export, Chat Export
        Doctor and Wrapped still use the original source. Participant labels
        stay in this tab.
      </p>
    </section>
  );
}
