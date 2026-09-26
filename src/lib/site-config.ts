export const productionOrigin = "https://instascope.me";
export function indexableDeployment(
  origin: string | undefined,
  preview: string | undefined,
) {
  return preview !== "true" && origin?.replace(/\/$/, "") === productionOrigin;
}
