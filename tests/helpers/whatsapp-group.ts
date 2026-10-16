// Deliberately synthetic labels/content only. Reversed numeric label names make
// accepted-source order different from alphabetic order in tied group rankings.
export const groupPrivateMarker = "SYNTHETIC_GROUP_PRIVATE";

export function syntheticGroupLabel(index: number, participants: number) {
  return `${groupPrivateMarker}_LABEL_${String(participants - index).padStart(2, "0")}_${"longlabel".repeat(12)}`;
}

export function syntheticGroupChat(participants: number, days = 3) {
  const lines = ["01/01/2026, 08:00 - [Anruf]"];
  for (let day = 1; day <= days; day++) {
    for (let round = 0; round < 2; round++) {
      for (let index = 0; index < participants; index++) {
        const minute = round * participants + index;
        const body =
          day === 1 && round === 0
            ? "image omitted"
            : day === 1 && round === 1 && index === 0
              ? "[Anruf]"
              : `${groupPrivateMarker}_BODY orchard meadow orchard meadow?`;
        lines.push(
          `${String(day).padStart(2, "0")}/01/2026, ${String(9 + Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")} - ${syntheticGroupLabel(index, participants)}: ${body}`,
        );
      }
    }
  }
  return lines.join("\n");
}
