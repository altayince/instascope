import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  createSnapshotReminder,
  escapeCalendarText,
  foldCalendarLine,
  serializeSnapshotReminder,
} from "../../src/lib/snapshot-reminder";

// Construct the actual save instant in the runtime's local timezone, as the UI
// does. Calendar arithmetic and serialization must preserve these dates.
function localSave(year: number, month: number, day: number, hour = 12) {
  return new Date(year, month - 1, day, hour, 4, 5).getTime();
}

describe("Next Snapshot reminder dates", () => {
  it("uses a saved export date only when its 30-day reminder is still future", () => {
    const savedAt = localSave(2026, 10, 13);
    expect(createSnapshotReminder("2026-10-13", savedAt)).toMatchObject({
      eventDate: "2026-11-12",
      basisDate: "2026-10-13",
      basis: "export-date",
      generatedAt: savedAt,
    });
    expect(createSnapshotReminder("2026-09-14", savedAt)).toMatchObject({
      eventDate: "2026-10-14",
      basisDate: "2026-09-14",
      basis: "export-date",
    });
  });

  it("falls back to the actual local save day for old, future or invalid dates", () => {
    const savedAt = localSave(2026, 10, 13, 23);
    for (const exportDate of [
      "2026-09-13", // Its 30-day reminder would be today.
      "2024-01-15",
      "2026-10-14",
      "9999-12-31",
      "2026-02-30",
      "0000-01-01",
      "",
    ]) {
      expect(createSnapshotReminder(exportDate, savedAt)).toMatchObject({
        eventDate: "2026-11-12",
        basisDate: "2026-10-13",
        basis: "save-date",
      });
    }
  });

  it("adds calendar days through leap days and year boundaries", () => {
    expect(addCalendarDays("2024-01-30", 30)).toBe("2024-02-29");
    expect(addCalendarDays("2024-02-29", 30)).toBe("2024-03-30");
    expect(addCalendarDays("2026-12-15", 30)).toBe("2027-01-14");
    expect(addCalendarDays("1900-02-28", 1)).toBe("1900-03-01");
    expect(addCalendarDays("2000-02-28", 1)).toBe("2000-02-29");
    expect(addCalendarDays("0099-12-31", 1)).toBe("0100-01-01");
  });

  it("preserves all-day dates across daylight-saving transitions", () => {
    expect(
      createSnapshotReminder("2026-03-20", localSave(2026, 3, 20)),
    ).toMatchObject({ eventDate: "2026-04-19", basis: "export-date" });
    expect(
      createSnapshotReminder("2026-10-20", localSave(2026, 10, 20)),
    ).toMatchObject({ eventDate: "2026-11-19", basis: "export-date" });
    expect(
      createSnapshotReminder("2025-01-01", localSave(2026, 3, 20, 23)),
    ).toMatchObject({ eventDate: "2026-04-19", basisDate: "2026-03-20" });
  });

  it("rejects impossible dates, unsafe intervals and invalid save instants", () => {
    for (const date of ["2026-02-29", "2026-13-01", "2026-1-01", "0000-01-01"])
      expect(() => addCalendarDays(date, 30)).toThrow(/valid calendar date/);
    for (const days of [NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1])
      expect(() => addCalendarDays("2026-01-01", days)).toThrow();
    expect(() => addCalendarDays("9999-12-31", 1)).toThrow(/calendar range/);
    expect(() => addCalendarDays("0001-01-01", -1)).toThrow(/calendar range/);
    for (const savedAt of [NaN, Infinity, 0.5, 8.64e15 + 1])
      expect(() => createSnapshotReminder("2026-01-01", savedAt)).toThrow(
        /creation time/,
      );
  });
});

describe("local RFC 5545 calendar serialization", () => {
  it("creates a generic one-day event with a UTC stamp and exclusive next-day end", () => {
    const generatedAt = Date.parse("2026-10-13T22:04:05.678Z");
    const reminder = {
      ...createSnapshotReminder("2026-10-13", generatedAt),
      eventDate: "2026-12-31",
      id: "private-snapshot-id",
      followersCount: 987654,
      followers: ["private.synthetic.username"],
      following: ["another.private.fixture"],
    };
    const raw = serializeSnapshotReminder(reminder);
    const unfolded = raw.replace(/\r\n[ \t]/g, "");
    expect(unfolded).toContain("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n");
    expect(unfolded).toContain("DTSTAMP:20261013T220405Z\r\n");
    expect(unfolded).toContain("DTSTART;VALUE=DATE:20261231\r\n");
    expect(unfolded).toContain("DTEND;VALUE=DATE:20270101\r\n");
    expect(unfolded).toContain(
      "SUMMARY:Export fresh Instagram data and return to InstaScope\r\n",
    );
    expect(unfolded).toContain("InstaScope sends no notification\\;");
    expect(unfolded).toContain("URL:https://instascope.me/snapshot-vault/\r\n");
    expect(unfolded).not.toMatch(
      /VALARM|TZID|ATTENDEE|ORGANIZER|RRULE|private|987654|followers|following/i,
    );
    expect(raw.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(raw.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
    expect(
      raw
        .split("\r\n")
        .every((line) => new TextEncoder().encode(line).byteLength <= 75),
    ).toBe(true);
  });

  it("creates an event-only random UID per offer and reuses it for repeat downloads", () => {
    const first = createSnapshotReminder("2026-10-13", localSave(2026, 10, 13));
    const second = createSnapshotReminder(
      "2026-10-13",
      localSave(2026, 10, 13),
    );
    expect(first.uid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}@instascope\.me$/i,
    );
    expect(first.uid).not.toBe(second.uid);
    expect(serializeSnapshotReminder(first)).toBe(
      serializeSnapshotReminder(first),
    );
    expect(serializeSnapshotReminder(first)).toContain(`UID:${first.uid}\r\n`);
  });

  it("escapes calendar TEXT and folds by UTF-8 bytes without splitting characters", () => {
    expect(escapeCalendarText("a\\b; c, d\r\nline\rnext\nlast")).toBe(
      "a\\\\b\\; c\\, d\\nline\\nnext\\nlast",
    );
    const line = `DESCRIPTION:${"é📷".repeat(50)}`;
    const folded = foldCalendarLine(line);
    expect(folded).toContain("\r\n ");
    expect(folded.replace(/\r\n /g, "")).toBe(line);
    for (const physical of folded.split("\r\n")) {
      expect(new TextEncoder().encode(physical).byteLength).toBeLessThanOrEqual(
        75,
      );
      expect(physical).not.toContain("\ufffd");
      expect(new TextDecoder().decode(new TextEncoder().encode(physical))).toBe(
        physical,
      );
    }
    expect(foldCalendarLine("x".repeat(75))).toBe("x".repeat(75));
    expect(foldCalendarLine("x".repeat(76))).toBe(`${"x".repeat(75)}\r\n x`);
    expect(() => foldCalendarLine("SUMMARY:x\r\nATTENDEE:y")).toThrow(
      /raw line breaks/,
    );
  });

  it("rejects invalid event dates and content-line injection through the UID", () => {
    const reminder = createSnapshotReminder(
      "2026-10-13",
      localSave(2026, 10, 13),
    );
    for (const eventDate of [
      "2026-02-30",
      "0000-01-01",
      "2026-10-13\r\nSUMMARY:x",
    ])
      expect(() =>
        serializeSnapshotReminder({ ...reminder, eventDate }),
      ).toThrow(/invalid/);
    expect(() =>
      serializeSnapshotReminder({ ...reminder, eventDate: "9999-12-31" }),
    ).toThrow(/calendar range/);
    expect(() =>
      serializeSnapshotReminder({
        ...reminder,
        uid: "event\r\nATTENDEE:private",
      }),
    ).toThrow(/invalid/);
    expect(() =>
      serializeSnapshotReminder({ ...reminder, generatedAt: NaN }),
    ).toThrow(/creation time/);
  });
});
