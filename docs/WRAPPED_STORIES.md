# Wrapped V2 relationship stories

Wrapped is a small pack of portrait stories derived from the current export and, when supplied, an older export. Each card has one lead fact, a few supporting aggregate facts, an explicit data boundary, and InstaScope branding. Downloaded PNGs are 1080 × 1920.

| Story | Appears when | Claim boundary |
| --- | --- | --- |
| My Instagram Circle | A valid current export is loaded | Counts and mutual share describe that export, not a live account. |
| My Instagram Timeline | At least one current Following entry has a usable timestamp | Earliest and latest dates are recorded dates, not proof of continuous following. Undated entries stay unknown. |
| Instagram Archaeology | Dated current follows span at least two years | The strongest year counts current follows with that recorded year; it is not a historical follower total. |
| Since My Last Snapshot | An older and newer export have been explicitly supplied | Added and missing accounts, mutual changes and net deltas describe only differences between those two files. No exact time or cause is inferred. |

The model in `src/lib/analysis/stories.ts` accepts normalized relationship analysis and comparison results. It returns presentation text and aggregate values only. No username, profile URL, sent request, privacy list or unfollow-history record enters a story. The preview and canvas export must use the same model so visible claims match downloaded claims. The fictional demo remains clearly labeled on every card.
