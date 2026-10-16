/** Owner-reviewed release decisions; unknown platforms remain unreleased. */
export const PLATFORM_RELEASES = {
  instagram: "released",
  whatsapp: "released",
} as const;

export function platformReleased(platform: string) {
  return (
    Object.hasOwn(PLATFORM_RELEASES, platform) &&
    PLATFORM_RELEASES[platform as keyof typeof PLATFORM_RELEASES] === "released"
  );
}

/** Preview opt-ins remain separate from intentional production releases. */
export function whatsappPreviewEnabled(
  requested: string | undefined,
  preview: string | undefined,
  branches: readonly (string | undefined)[] = [],
) {
  const known = branches.filter((branch): branch is string => !!branch);
  return (
    requested === "true" &&
    preview === "true" &&
    known.length > 0 &&
    known.every((branch) => branch === branch.trim() && branch !== "HEAD") &&
    !known.some((branch) => branch === "main" || branch === "refs/heads/main")
  );
}

export function whatsappFeatureEnabled(
  requested: string | undefined,
  preview: string | undefined,
  branches: readonly (string | undefined)[] = [],
  production = false,
  host: {
    pages?: string;
    pagesBranch?: string;
    workers?: string;
    workersBranch?: string;
  } = {},
) {
  const hostBranches = [
    ...(host.pages === "1" ? [host.pagesBranch] : []),
    ...(host.workers === "1" ? [host.workersBranch] : []),
  ];
  if (
    hostBranches.some(
      (branch) => !branch || branch !== branch.trim() || branch === "HEAD",
    )
  )
    return false;
  return (
    (platformReleased("whatsapp") && production) ||
    whatsappPreviewEnabled(requested, preview, branches)
  );
}
