import type { Story } from "@/lib/analysis/stories";

// Shared by the on-screen preview and the exported image.
export const storyStyles: Record<
  Story["id"],
  {
    background: string;
    ink: string;
    accent: string;
    motif: "rings" | "rays" | "steps";
  }
> = {
  origins: {
    background: "#163f3e",
    ink: "#fff6e5",
    accent: "#f5d88e",
    motif: "rings",
  },
  circle: {
    background: "#3020a0",
    ink: "#fff6e5",
    accent: "#ddff65",
    motif: "rings",
  },
  orbit: {
    background: "#ffd3e8",
    ink: "#491636",
    accent: "#a21f62",
    motif: "rings",
  },
  timeline: {
    background: "#ffdb70",
    ink: "#452409",
    accent: "#9b360b",
    motif: "steps",
  },
  archaeology: {
    background: "#d9c9ff",
    ink: "#32196a",
    accent: "#6234b4",
    motif: "rays",
  },
  discovery: {
    background: "#ef5328",
    ink: "#301608",
    accent: "#301608",
    motif: "rays",
  },
  timecapsule: {
    background: "#c2f3d4",
    ink: "#123c30",
    accent: "#176843",
    motif: "rings",
  },
  changes: {
    background: "#143dbc",
    ink: "#f5f6ff",
    accent: "#a2edff",
    motif: "steps",
  },
  turnover: {
    background: "#edfc8b",
    ink: "#29381d",
    accent: "#4b661b",
    motif: "rays",
  },
};
