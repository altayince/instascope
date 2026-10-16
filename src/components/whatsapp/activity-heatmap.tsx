"use client";

import type { CSSProperties } from "react";
import { whatsappNumber } from "@/lib/whatsapp/stories";

const weekdays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const hours = Array.from({ length: 24 }, (_, hour) =>
  String(hour).padStart(2, "0"),
);

export function WhatsAppActivityHeatmap({ counts }: { counts: number[][] }) {
  const maximum = Math.max(0, ...counts.flat());
  return (
    <section
      className="wa-panel wa-heatmap-panel"
      aria-labelledby="wa-heatmap-title"
    >
      <div className="wa-panel-heading">
        <div>
          <span className="wa-eyebrow">THE RECORDED WEEK, HOUR BY HOUR</span>
          <h3 id="wa-heatmap-title">Activity by recorded weekday and hour</h3>
        </div>
      </div>
      <p>
        Exported participant messages in the selected subset. Brighter cells
        contain more messages. These are written clock values, without an
        inferred timezone; they do not show online presence.
      </p>
      <div
        className="wa-heatmap-scroll"
        role="region"
        aria-label="Scrollable weekday and hour activity table"
        tabIndex={0}
      >
        <table className="wa-heatmap-table">
          <caption>
            Exported participant messages by recorded weekday and hour
          </caption>
          <thead>
            <tr>
              <th scope="col">Day / hour</th>
              {hours.map((hour) => (
                <th scope="col" key={hour}>
                  {hour}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weekdays.map((day, weekday) => (
              <tr key={day}>
                <th scope="row">{day.slice(0, 3)}</th>
                {hours.map((hour, index) => {
                  const count = counts[weekday][index];
                  const label = `${day}, ${hour}:00: ${whatsappNumber(count)} exported participant messages`;
                  return (
                    <td
                      key={hour}
                      title={label}
                      aria-label={label}
                      className={count ? "is-active" : undefined}
                      style={
                        {
                          "--wa-intensity": maximum
                            ? 0.2 + (count / maximum) * 0.8
                            : 0,
                        } as CSSProperties
                      }
                    >
                      <span>{count ? whatsappNumber(count) : "·"}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="wa-hint">
        On a narrow screen, scroll the table horizontally or read the exact
        counts below. Senderless system events are excluded.
      </p>
      <details className="wa-chart-data wa-heatmap-values">
        <summary>Read weekday and hour values</summary>
        {weekdays.map((day, weekday) => (
          <div key={day}>
            <h4>{day}</h4>
            <ul>
              {hours.map((hour, index) => (
                <li key={hour}>
                  <span>{hour}:00</span>
                  <strong>{whatsappNumber(counts[weekday][index])}</strong>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </details>
    </section>
  );
}
