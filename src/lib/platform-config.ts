/** Unreleased platforms require an explicit preview build outside main. */
export function whatsappFeatureEnabled(
  requested: string | undefined,
  preview: string | undefined,
  branches: readonly (string | undefined)[] = [],
) {
  const known = branches.filter((branch): branch is string => !!branch);
  return (
    requested === "true" &&
    preview === "true" &&
    known.length > 0 &&
    !known.some((branch) => branch === "main" || branch === "refs/heads/main")
  );
}
