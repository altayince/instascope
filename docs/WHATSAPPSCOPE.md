# WhatsAppScope foundation (INS-114)

WhatsAppScope is an unreleased member of the InstaScope product family. Work
starts from `dev`; the review PR targets `dev` only. This task performs no main
merge, production deployment, or Cloudflare configuration change.

## Release isolation and local review

Default/production exports have no WhatsApp routes or visible platform switcher.
The gate needs `NEXT_PUBLIC_WHATSAPP_ENABLED=true`, `NEXT_PUBLIC_PREVIEW=true`,
and a known non-main build branch. Local Git, Cloudflare and GitHub branch values
are checked; any known main context disables the feature. `build:production`
forces preview off. Public-path/sitemap registration is unchanged; WhatsApp
pages always carry `noindex, nofollow`.

From a dev-derived branch:

```text
npm run dev:family
npm run build:dev
npm run preview
```

The dev build is a local/preview artifact, not a deploy command. It leaves remote
analytics and the optional Instagram photo endpoint disabled by default. Do not
publish its `out` directory to production. Rebuild with `build:production` to
restore the release artifact. CI separately validates production Instagram and
enabled preview WhatsApp builds; no CI deployment is added.

## Architecture

- `platforms.ts` is the route/identity, navigation and footer registry; only Instagram and
  WhatsApp are exposed. The shared shell chooses navigation, brand and scoped
  design tokens from the active route. Disabled builds retain the existing
  Instagram shell. Typography, spacing and generic actions stay shared.
  Each platform has an explicit availability decision; WhatsApp opt-in cannot
  automatically expose a future unfinished platform.
- `src/lib/whatsapp` owns its types, parser, normalization, bounded importer,
  pure analysis and story model. It imports no Instagram domain types.
- `src/components/whatsapp` owns an independent tab-memory provider, import UI,
  factual charts and local Wrapped drawing/sharing. Platform navigation preserves
  active data across routes; reload/clear removes the chat. No chat persistence,
  account, credentials, cloud sync or new analytics event is introduced.
  Clearing/unmounting terminates a pending reader. An accepted replacement resets
  chart, participant and card navigation; a failed import keeps the prior chat.
- `/whatsapp/`, `/whatsapp/chat-analyzer/`, `/whatsapp/wrapped/` are gated server
  pages. The product is independent and not affiliated with WhatsApp or Meta.

## Explicitly supported input

Choose one UTF-8 `.txt`, or one single-disk ZIP32 containing exactly one chat
`.txt`. Attachments are ignored, never decompressed or interpreted as messages.
Multiple TXT candidates, encrypted/multipart/ZIP64/damaged archives, invalid
UTF-8 and resource-limit breaches fail with a controlled explanation.

Limits are 20 MB for chat text, 1 GB for the ZIP, 4 MB for its index, 10,000 ZIP
entries, 200,000 records and 10,000 participant labels (256 characters each).
The import worker has a 45-second timeout. These are safety ceilings, not a
promise that every phone can comfortably analyze a chat at the maximum size.

The format selector requires a deliberate date-order and clock choice. Initial
synthetic fixtures cover DMY, MDY and YMD numeric dates with **four-digit years**,
24-hour clocks or English AM/PM, and Android `date, time - sender: content` or iOS
`[date, time] sender: content` wrappers. Optional seconds are retained as source
precision. These fixtures demonstrate those exact parser contracts; no genuine
WhatsApp archive was supplied for this task, and universal export compatibility
is not claimed. Two-digit years/centuries, named/localized months, translated
AM/PM and unknown wrappers require verified evidence before support is widened.
DMY/MDY use slash-separated dates; YMD uses hyphens. Years are 1000–9999.

Dates must be valid Gregorian calendar dates and clock values. Exports provide
no timezone; stored calendar fields and duration/gap calculations describe
recorded wall-clock values, not exact UTC elapsed time. Day/month/hour/weekday
charts use those recorded fields, not an inferred viewer timezone.

Multiline text continues the preceding record. A pasted line identical to an
export header is inherently ambiguous; the UI explains that text exports do not
prove every boundary. Header-shaped unsupported/mixed formats are rejected.
Sender labels are grouped exactly as exported, not treated as verified account
identity. System lines without a sender delimiter are separate from participant
messages. Export text is never executed or inserted as HTML.

## Factual analysis and limitations

Counts cover supplied participant messages, separate system events, messages
per exported label, first/latest recorded timestamps, observed span, yearly/
monthly/daily activity, weekdays/hours, busiest recorded periods, exact supported
media placeholders, HTTP(S) link occurrences, supported emoji graphemes, longest
observed wall-clock gap and consecutive recorded active days. Missing periods
are not reconstructed; a gap means no message in this export, not that nobody
communicated. First/latest records do not establish the real start/end of a
relationship. No compatibility, love, toxicity or personality scoring exists.
Participant lists and longer charts use bounded pagination; all recorded values
remain reachable. The activity calendar renders one selected month at a time.

Media counts recognize exact whole English omission markers only; they do not
recover or inspect files. Link counts do not visit URLs or claim uniqueness.
Emoji counts require native `Intl.Segmenter` plus supported Unicode emoji
sequence matching; unsupported runtimes show unavailable instead of zero.

## Privacy and Wrapped

Files, text, sender labels, media, URLs and derived private statistics stay local.
No WhatsApp-domain code calls the product analytics collector. No archive, chat
identifier or persistent chat state is written to browser storage. Loading same-
origin application assets/worker code is not an archive upload.

Wrapped cards contain factual aggregate activity and anonymous participant
aliases, without personal labels, message bodies or link URLs. Review cards
before deliberately downloading or using the device share sheet: exported
statistics become a file that the user may choose to share. Card generation
does not contact a server or third-party inference service.

All tests use minimal synthetic fixtures. Automated desktop/mobile/WebKit
coverage is not physical iPhone/Android testing or evidence for untested real
exports/locales. New formats need representative, locally inspected evidence
and anonymized regression fixtures; never commit personal chats or media.

## Validation commands

`npm run check` and the full default Playwright suite validate the production
Instagram build plus disabled-route isolation. For enabled preview coverage,
build with `npm run build:dev`, set `EXPECT_WHATSAPP=true`, and run
`npx playwright test --config playwright.whatsapp.config.ts`. This focused
configuration includes desktop/mobile Chromium and iPhone WebKit emulation;
install those browsers with `npx playwright install chromium webkit` if needed.
Restore the production artifact with `npm run build:production` after review.
