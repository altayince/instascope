import type { Dataset } from "../instagram/types";
import type { Analysis, compareSnapshots } from "./relationships";
import { relationshipTimeline, utcDate } from "./insights";

export type Story = {
  id:
    | "circle"
    | "orbit"
    | "timeline"
    | "archaeology"
    | "discovery"
    | "timecapsule"
    | "changes"
    | "turnover";
  name: string;
  bars?: { label: string; value: number }[];
  label: string;
  title: string;
  lead: string;
  heroValue: string;
  heroLabel: string;
  facts: { value: string; label: string }[];
  note: string;
};

type Comparison = ReturnType<typeof compareSnapshots> | null;
const count = (value: number) => value.toLocaleString("en-US");
const signed = (value: number) => `${value > 0 ? "+" : ""}${count(value)}`;

export function buildStories(
  analysis: Analysis,
  _dataset: Dataset,
  comparison: Comparison,
): Story[] {
  const mutualShare = analysis.following.length
    ? Math.round((analysis.mutuals.length / analysis.following.length) * 100)
    : null;
  const stories: Story[] = [
    {
      id: "circle",
      name: "My circle",
      bars: [
        { label: "Mutual", value: analysis.mutuals.length },
        { label: "One-way", value: analysis.notFollowingBack.length },
      ],
      label: "MY INSTAGRAM CIRCLE",
      title: mutualShare ? "The feeling is mutual." : "My circle, my way.",
      lead: "My follow-back energy, in one number.",
      heroValue:
        mutualShare === null
          ? count(analysis.followers.length)
          : `${mutualShare}%`,
      heroLabel:
        mutualShare === null
          ? "followers recorded in this export"
          : "of accounts you follow also appear in your followers list",
      facts: [
        { value: count(analysis.followers.length), label: "followers" },
        { value: count(analysis.following.length), label: "following" },
        { value: count(analysis.mutuals.length), label: "mutuals" },
        {
          value: count(analysis.notFollowingBack.length),
          label: "one-way follows",
        },
      ],
      note: "These counts describe the uploaded export, not live Instagram.",
    },
  ];

  const circleSize =
    analysis.mutuals.length +
    analysis.fans.length +
    analysis.notFollowingBack.length;
  if (circleSize > 0)
    stories.push({
      id: "orbit",
      name: "My social orbit",
      label: "MY SOCIAL ORBIT",
      title: "One circle. Three sides.",
      lead: "Every account in my orbit, counted once.",
      heroValue: count(circleSize),
      heroLabel: "unique accounts across my followers and following",
      bars: [
        { label: "Mutual", value: analysis.mutuals.length },
        { label: "Follow me", value: analysis.fans.length },
        { label: "I follow", value: analysis.notFollowingBack.length },
      ],
      facts: [
        {
          value: count(analysis.mutuals.length),
          label: "we follow each other",
        },
        {
          value: count(analysis.fans.length),
          label: "follow me; I don't follow back",
        },
        {
          value: count(analysis.notFollowingBack.length),
          label: "I follow; don't follow me back",
        },
      ],
      note: "An export snapshot, not a measure of friendship or attention.",
    });

  // Use deduplicated core records only. Optional/private lists never enter stories.
  const timeline = relationshipTimeline(analysis);
  if (timeline.coverage.following > 0) {
    stories.push({
      id: "timeline",
      name: "My following dates",
      bars: [
        { label: "Dated", value: timeline.coverage.following },
        {
          label: "Unknown",
          value: analysis.following.length - timeline.coverage.following,
        },
      ],
      label: "MY INSTAGRAM TIMELINE",
      title: "My follow time machine.",
      lead: "Follow dates recorded for accounts still in your Following list.",
      heroValue: utcDate(timeline.earliest!).slice(0, 4),
      heroLabel: "earliest recorded current follow year",
      facts: [
        {
          value: utcDate(timeline.earliest!),
          label: "earliest recorded date",
        },
        { value: utcDate(timeline.latest!), label: "latest recorded date" },
        {
          value: count(timeline.coverage.following),
          label: "current follows with dates",
        },
        {
          value: count(analysis.following.length - timeline.coverage.following),
          label: "current follows without dates",
        },
      ],
      note: "Recorded dates do not prove continuous following or past totals.",
    });

    const years = timeline.periods.filter((period) => period.following > 0);
    if (years.length > 1 && timeline.busiest) {
      stories.push({
        id: "archaeology",
        name: "Instagram archaeology",
        bars: years
          .slice(-6)
          .map((p) => ({ label: p.period, value: p.following })),
        label: "INSTAGRAM ARCHAEOLOGY",
        title: "That was my era.",
        lead: "One year left the biggest mark on my current following list.",
        heroValue: timeline.busiest.period,
        heroLabel: "year with the most dated current follows",
        facts: [
          {
            value: count(timeline.busiest.following),
            label: "current follows recorded that year",
          },
          { value: count(years.length), label: "recorded years represented" },
        ],
        note: "Surviving dated follows, not past totals. Ties use the earliest year. Chart: up to six latest years.",
      });
    }
  }

  const months = relationshipTimeline(analysis, "month");
  const recordedMonths = months.periods.filter((p) => p.following > 0);
  if (recordedMonths.length > 1 && months.busiest) {
    const peak = months.busiest;
    const monthName = new Intl.DateTimeFormat("en-US", {
      month: "short",
      timeZone: "UTC",
    }).format(new Date(`${peak.period}-01T00:00:00Z`));
    stories.push({
      id: "discovery",
      name: "My discovery month",
      bars: [...recordedMonths]
        .sort(
          (a, b) =>
            b.following - a.following || a.period.localeCompare(b.period),
        )
        .slice(0, 3)
        .map((p) => ({ label: p.period, value: p.following })),
      label: "MY DISCOVERY MONTH",
      title: "A month with main-character energy.",
      lead: "The month most represented in my dated current follows.",
      heroValue: `${monthName} '${peak.period.slice(2, 4)}`,
      heroLabel: `${count(peak.following)} current follows carry a date from this month`,
      facts: [
        {
          value: `${Math.round((peak.following / months.coverage.following) * 100)}%`,
          label: "of my dated current follows",
        },
        {
          value: count(recordedMonths.length),
          label: "recorded months represented",
        },
      ],
      note: "Surviving records, not all follows made that month. Missing dates excluded; earliest month wins ties.",
    });
  }

  if (timeline.earliest !== undefined) {
    const firstYear = utcDate(timeline.earliest).slice(0, 4);
    const cohort = analysis.following.filter(
      (a) =>
        a.timestamp !== undefined && utcDate(a.timestamp).startsWith(firstYear),
    );
    const mutualNames = new Set(analysis.mutuals.map((a) => a.username));
    const mutualCount = cohort.filter((a) =>
      mutualNames.has(a.username),
    ).length;
    if (
      mutualCount > 0 &&
      timeline.periods.filter((p) => p.following > 0).length > 1
    )
      stories.push({
        id: "timecapsule",
        name: "My time capsule",
        label: "MY TIME CAPSULE",
        title: "Old dates. Mutual ties.",
        lead: `A little reunion with my earliest recorded follow year: ${firstYear}.`,
        heroValue: count(mutualCount),
        heroLabel: "mutuals in my oldest recorded follow-year cohort",
        bars: [
          { label: "Mutual", value: mutualCount },
          { label: "One-way", value: cohort.length - mutualCount },
        ],
        facts: [
          { value: firstYear, label: "earliest recorded follow year" },
          {
            value: `${Math.round((mutualCount / cohort.length) * 100)}%`,
            label: "of that year's current follows are mutual",
          },
        ],
        note: "Mutual in this export, not live. Old dates do not prove uninterrupted following or friendship.",
      });
  }

  if (comparison) {
    stories.push({
      id: "changes",
      name: "Since my last snapshot",
      bars: [
        { label: "Added", value: comparison.newFollowers.length },
        { label: "Missing", value: comparison.lostFollowers.length },
      ],
      label: "SINCE MY LAST SNAPSHOT",
      title: "My circle has a new chapter.",
      lead: "Differences between the older and newer files you chose.",
      heroValue: signed(comparison.followerDelta),
      heroLabel: "net followers between the two exports",
      facts: [
        {
          value: count(comparison.newFollowers.length),
          label: "added followers",
        },
        {
          value: count(comparison.lostFollowers.length),
          label: "missing followers",
        },
        {
          value: count(comparison.newMutuals.length),
          label: "new mutuals",
        },
        {
          value: count(comparison.lostMutuals.length),
          label: "lost mutuals",
        },
      ],
      note: "Two snapshots cannot reveal exactly when or why a change happened.",
    });
  }

  if (comparison)
    stories.push({
      id: "turnover",
      name: "Behind the number",
      label: "THE PLOT TWIST",
      title: "The total isn't the whole story.",
      lead: "A quiet follower count can hide a changing cast.",
      heroValue: count(
        comparison.newFollowers.length + comparison.lostFollowers.length,
      ),
      heroLabel: "follower-list differences behind the net number",
      facts: [
        {
          value: signed(comparison.followerDelta),
          label: "net follower change",
        },
        {
          value: count(
            comparison.newFollowers.length + comparison.lostFollowers.length,
          ),
          label: "added + missing accounts",
        },
        {
          value: count(comparison.newFollowing.length),
          label: "added to my following",
        },
        {
          value: count(comparison.removedFollowing.length),
          label: "missing from my following",
        },
      ],
      note: "List differences across two exports, not a count of actions. No timing or reasons inferred.",
    });

  // HTML dates are calendar records without a timezone. Never infer local hours,
  // elapsed relationship age or continuity from them (or from the import time).
  if (
    analysis.following.some(
      (a) => a.timestampPrecision === "minute-without-timezone",
    )
  ) {
    for (const story of stories) {
      if (
        ["timeline", "archaeology", "discovery", "timecapsule"].includes(
          story.id,
        )
      )
        story.note += " HTML dates have no timezone.";
    }
  }
  return stories;
}
