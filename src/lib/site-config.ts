export const productionOrigin = "https://instascope.me";
type BuildContext = {
  pages?: string;
  pagesBranch?: string;
  workers?: string;
  workersBranch?: string;
};
export function indexableDeployment(
  origin: string | undefined,
  preview: string | undefined,
  context: BuildContext = {},
) {
  if (preview === "true") return false;
  if (origin && origin.replace(/\/$/, "") !== productionOrigin) return false;
  // Cloudflare's branch variables identify the actual deployed build. A
  // preview branch must stay noindex even if it inherits production settings.
  const branches = [
    ...(context.pages === "1" ? [context.pagesBranch] : []),
    ...(context.workers === "1" ? [context.workersBranch] : []),
  ];
  if (branches.length) return branches.every((branch) => branch === "main");
  return origin?.replace(/\/$/, "") === productionOrigin;
}
