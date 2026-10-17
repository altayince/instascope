import { zipSync, strToU8 } from "fflate";

/** Fictional records written from scratch, never derived from a personal export. */
export const syntheticFacebookRows = [
  { name: "Deniz Örnek", timestamp: 1704103200 },
  { name: "Deniz Örnek", timestamp: 1430470800 },
  { name: "Mira Example 👩‍💻", timestamp: 1638352800 },
];
export function facebookHtml(rows: readonly { name: string; date?: string }[]) {
  const escape = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  return `<!doctype html><html><head><meta charset="utf-8"></head><body><header><h1>Fictional Facebook export</h1></header><main class="_a706">${rows.map((row) => `<section class="_a6-g"><h2 class="_2ph_ _a6-h _a6-i">${escape(row.name)}</h2><footer class="_3-94 _a6-o _2pie"><div class="_a72d">${escape(row.date ?? "")}</div></footer></section>`).join("")}</main></body></html>`;
}
export function syntheticFacebookFiles(
  format: "json" | "html",
): Record<string, string> {
  const prefix = "fictional-export/connections/friends/";
  if (format === "json")
    return {
      [prefix + "your_friends.json"]: JSON.stringify({
        friends_v2: syntheticFacebookRows.map((row) => ({
          ...row,
          name: Array.from(new TextEncoder().encode(row.name), (byte) =>
            String.fromCharCode(byte),
          ).join(""),
        })),
      }),
      [prefix + "received_friend_requests.json"]: JSON.stringify({
        received_requests_v2: [],
      }),
      [prefix + "rejected_friend_requests.json"]: JSON.stringify({
        rejected_requests_v2: [
          { name: "Rejected Example", timestamp: 0, marked_as_spam: true },
        ],
      }),
      "security_and_login_information/browser_cookies.json":
        '{"NEVER_READ":"PRIVATE_SYNTHETIC_COOKIE"}',
    };
  return {
    [prefix + "your_friends.html"]: facebookHtml([
      { name: syntheticFacebookRows[0].name, date: "Oca 1, 2024 1:00:00 pm" },
      { name: syntheticFacebookRows[1].name, date: "May 1, 2015 12:00:00 pm" },
      { name: syntheticFacebookRows[2].name, date: "Ara 1, 2021 1:00:00 pm" },
    ]),
    [prefix + "received_friend_requests.html"]: facebookHtml([]),
    [prefix + "rejected_friend_requests.html"]: facebookHtml([
      { name: "Rejected Example" },
    ]),
    "security_and_login_information/browser_cookies.html":
      "<p>PRIVATE_SYNTHETIC_COOKIE</p>",
  };
}
export const facebookZip = (files: Record<string, string>) =>
  zipSync(
    Object.fromEntries(
      Object.entries(files).map(([name, text]) => [name, strToU8(text)]),
    ),
  );
export const syntheticFacebookZip = (format: "json" | "html") =>
  facebookZip(syntheticFacebookFiles(format));
