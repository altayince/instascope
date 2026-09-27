import type { Dataset } from "../instagram/types";
import type { Analysis, compareSnapshots } from "./relationships";
import { relationshipTimeline, utcDate } from "./insights";

export type Story = {
  id: "circle" | "timeline" | "archaeology" | "changes";
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
  dataset: Dataset,
  comparison: Comparison,
): Story[] {
  const mutualShare = analysis.following.length
    ? Math.round((analysis.mutuals.length / analysis.following.length) * 100)
    : null;
  const stories: Story[] = [
    {
      id: "circle",
      label: "01 / MY INSTAGRAM CIRCLE",
      title: "Your circle, in perspective.",
      lead: "A snapshot of the relationships in this export.",
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

  const timeline = relationshipTimeline(dataset);
  if (timeline.coverage.following > 0) {
    stories.push({
      id: "timeline",
      label: "02 / MY INSTAGRAM TIMELINE",
      title: "The dates in your circle.",
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
          value: count(dataset.following.length - timeline.coverage.following),
          label: "current follows without dates",
        },
      ],
      note: "Recorded dates do not prove continuous following or past totals.",
    });

    const years = timeline.periods.filter((period) => period.following > 0);
    if (years.length > 1 && timeline.busiest) {
      stories.push({
        id: "archaeology",
        label: "03 / INSTAGRAM ARCHAEOLOGY",
        title: "A year in your follow history.",
        lead: "Current follows grouped by their recorded year.",
        heroValue: timeline.busiest.period,
        heroLabel: "year with the most dated current follows",
        facts: [
          {
            value: count(timeline.busiest.following),
            label: "current follows recorded that year",
          },
          { value: count(years.length), label: "recorded years represented" },
        ],
        note: "These are surviving records, not a history of follower totals.",
      });
    }
  }

  if (comparison) {
    stories.push({
      id: "changes",
      label: "SINCE MY LAST SNAPSHOT",
      title: "What changed between exports.",
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
        {
          value: signed(comparison.followingDelta),
          label: "net following",
        },
      ],
      note: "Two snapshots cannot reveal exactly when or why a change happened.",
    });
  }

  return stories;
}
