import {
  historyTransitions,
  relationshipStateLabels,
  type RelationshipHistoryPoint,
} from "@/lib/analysis/relationship-history";
import { formatSnapshotDate } from "@/lib/snapshot-vault";
export function AccountHistoryDetails({
  points,
  singleSnapshotMessage = "At least two saved snapshots are needed to observe changes.",
  transitionHeadingLevel = 3,
}: {
  points: RelationshipHistoryPoint[];
  singleSnapshotMessage?: string;
  transitionHeadingLevel?: 3 | 5;
}) {
  const TransitionHeading = transitionHeadingLevel === 3 ? "h3" : "h5";
  const transitions = historyTransitions(points);
  return (
    <>
      <table className="history-observations">
        <caption>Observed state in each saved snapshot</caption>
        <thead>
          <tr>
            <th scope="col">Snapshot date</th>
            <th scope="col">Observed state</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.snapshotId}>
              <th scope="row">{formatSnapshotDate(point.exportDate)}</th>
              <td>
                <span className="history-state" data-state={point.state}>
                  {relationshipStateLabels[point.state]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Absent means absent from Followers and Following in that snapshot. It
        does not establish an unfollow, block, deletion or cause.
      </p>
      {points.length < 2 ? (
        <p>{singleSnapshotMessage}</p>
      ) : points.filter((p) => p.state !== "absent").length === 1 ? (
        <p>
          This username appears in only one saved snapshot; its history is
          limited.
        </p>
      ) : null}
      <TransitionHeading>Observed transitions</TransitionHeading>
      {transitions.length ? (
        <ul className="history-transitions">
          {transitions.map((transition) => (
            <li key={`${transition.olderDate}:${transition.newerDate}`}>
              <strong>
                Observed between {formatSnapshotDate(transition.olderDate)} and{" "}
                {formatSnapshotDate(transition.newerDate)}
              </strong>
              {transition.observations.map((text) => (
                <p key={text}>{text}</p>
              ))}
            </li>
          ))}
        </ul>
      ) : (
        <p>No state change observed in these saved snapshots.</p>
      )}
      <p>
        These observations do not establish exact change times, uninterrupted
        relationships or what happened between snapshots.
      </p>
    </>
  );
}
