/** Repair only independently valid UTF-8 sequences represented as Latin-1.
 * Valid Unicode outside these runs is untouched; a candidate must round-trip.
 */
export function repairFacebookText(value: string): string {
  const windowsCharacters =
    "€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ";
  const recover = (text: string) =>
    text.replace(
      /[\u00c2-\u00f4][\u0080-\u00bf€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]+/g,
      (run) => {
        const bytes = Uint8Array.from(run, (char) => {
          const mapped = windowsCharacters.indexOf(char);
          return mapped >= 0 ? 0x80 + mapped : char.charCodeAt(0);
        });
        try {
          const decoded = new TextDecoder("utf-8", { fatal: true }).decode(
            bytes,
          );
          const encoded = new TextEncoder().encode(decoded);
          return encoded.length === bytes.length &&
            encoded.every((byte, i) => byte === bytes[i])
            ? decoded
            : run;
        } catch {
          return run;
        }
      },
    );
  let result = value;
  for (let pass = 0; pass < 4; pass++) {
    const candidate = recover(result);
    if (candidate === result)
      return /[\u0000-\u001f\u007f-\u009f]/u.test(result) ? value : result;
    result = candidate;
  }
  // Avoid returning a partially recovered value that changes on another call.
  return recover(result) === result &&
    !/[\u0000-\u001f\u007f-\u009f]/u.test(result)
    ? result
    : value;
}

export function facebookTimestamp(value: unknown): number | undefined {
  // 0/1 sentinel values are not relationship dates. Do not guess milliseconds.
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 86400 &&
    value <= 253402300799
    ? value
    : undefined;
}

const monthGroups = [
  ["jan", "january", "oca", "ocak"],
  ["feb", "february", "şub", "şubat"],
  ["mar", "march", "mart"],
  ["apr", "april", "nis", "nisan"],
  ["may", "mayıs"],
  ["jun", "june", "haz", "haziran"],
  ["jul", "july", "tem", "temmuz"],
  ["aug", "august", "ağu", "ağustos"],
  ["sep", "sept", "september", "eyl", "eylül"],
  ["oct", "october", "eki", "ekim"],
  ["nov", "november", "kas", "kasım"],
  ["dec", "december", "ara", "aralık"],
];

/** Explicit observed Meta month-first form plus day-first EN/TR variants.
 * No Date.parse locale guesses, host timezone or invented export timezone.
 */
export function parseFacebookHtmlDate(value: string): string | undefined {
  const clean = repairFacebookText(value)
    .replace(/[\u00a0\u202f]/g, " ")
    .trim()
    .toLocaleLowerCase("tr");
  const monthFirst = clean.match(
    /^(\p{L}+)\.? (\d{1,2}),? (\d{4}) (\d{1,2}):(\d{2})(?::(\d{2}))?(?: (am|pm))?$/u,
  );
  const dayFirst = clean.match(
    /^(\d{1,2}) (\p{L}+)\.? (\d{4})[,]? (\d{1,2}):(\d{2})(?::(\d{2}))?(?: (am|pm))?$/u,
  );
  if (!monthFirst && !dayFirst) return;
  const fields = monthFirst ?? dayFirst!;
  const token = fields[monthFirst ? 1 : 2];
  const month = monthGroups.findIndex((names) => names.includes(token)) + 1;
  const day = Number(fields[monthFirst ? 2 : 1]);
  const year = Number(fields[3]);
  let hour = Number(fields[4]);
  const minute = Number(fields[5]),
    second = Number(fields[6] ?? 0),
    period = fields[7];
  if (
    !month ||
    year < 1970 ||
    hour > (period ? 12 : 23) ||
    (period && hour < 1) ||
    minute > 59 ||
    second > 59
  )
    return;
  if (period) hour = (hour % 12) + (period === "pm" ? 12 : 0);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return;
  return date.toISOString().slice(0, 19);
}
