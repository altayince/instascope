import { deduplicate } from "../instagram/normalize";
import type { Account, Dataset } from "../instagram/types";
export function analyze(dataset: Pick<Dataset, "followers" | "following">) {
  const followers = deduplicate(dataset.followers),
    following = deduplicate(dataset.following);
  const followerSet = new Set(followers.map((a) => a.username)),
    followingSet = new Set(following.map((a) => a.username));
  return {
    followers,
    following,
    mutuals: following.filter((a) => followerSet.has(a.username)),
    notFollowingBack: following.filter((a) => !followerSet.has(a.username)),
    fans: followers.filter((a) => !followingSet.has(a.username)),
    ratio: following.length ? followers.length / following.length : null,
  };
}
export type Analysis = ReturnType<typeof analyze>;
export function compareSnapshots(older: Dataset, newer: Dataset) {
  const old = analyze(older),
    current = analyze(newer);
  const difference = (a: Account[], b: Account[]) => {
    const set = new Set(b.map((v) => v.username));
    return a.filter((v) => !set.has(v.username));
  };
  return {
    newFollowers: difference(current.followers, old.followers),
    lostFollowers: difference(old.followers, current.followers),
    newFollowing: difference(current.following, old.following),
    removedFollowing: difference(old.following, current.following),
    newMutuals: difference(current.mutuals, old.mutuals),
    lostMutuals: difference(old.mutuals, current.mutuals),
    followerDelta: current.followers.length - old.followers.length,
    followingDelta: current.following.length - old.following.length,
  };
}
