# WhatsApp public search coverage (INS-154)

This inventory describes the proposed public search surface, not Google indexing
or traffic recovery. Production verification follows the owner's deployment;
Search Console evidence is a separate step. Existing Instagram URLs stay intact.

The four product pages perform tasks. The guide hub helps readers choose a
question. Ten guides teach distinct workflows or explain their results. All ten
proposed intents are supported by current code, so none were excluded or merged.
No keyword-variant, participant, chat, snapshot or private-result pages are added.

## Coverage and intent boundaries

All paths below are relative to `https://instascope.me`.

| Public path                                           | Primary question / purpose                      | Distinct evidence or example                                                           | Working destination                  |
| ----------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------ |
| `/whatsapp/`                                          | What can I do with a local WhatsApp export?     | Existing fictional demo preview and import/demo entry                                  | Analyzer, Wrapped, Vault             |
| `/whatsapp/chat-analyzer/`                            | Analyze this supplied chat                      | Existing filters, charts, content and rhythm calculations                              | Existing import and Analyzer         |
| `/whatsapp/wrapped/`                                  | Make and download cards from this chat          | Existing evidence-gated story renderer                                                 | Existing PNG/share/deck ZIP controls |
| `/whatsapp/chat-vault/`                               | Save, reopen and compare aggregate summaries    | Local snapshot, backup and comparison explanations                                     | Existing Vault controls              |
| `/whatsapp/guides/`                                   | Which guide answers my question?                | Links to all ten distinct guide intents and tools                                      | Relevant guide/tool                  |
| `/whatsapp/guides/export-whatsapp-chat/`              | Get the right source file                       | Synthetic ambiguous/numeric timestamp examples; text export versus cloud backup        | Chat Analyzer                        |
| `/whatsapp/guides/analyze-group-chat/`                | Read participant counts in a group              | Three fictional labels tied at 8 of 24 messages                                        | Chat Analyzer; Wrapped               |
| `/whatsapp/guides/chat-activity-heatmap/`             | Interpret weekday × hour activity               | Three invented messages mapped to two grid cells                                       | Chat Analyzer                        |
| `/whatsapp/guides/message-and-media-statistics/`      | Understand message, media and link denominators | Four fictional records produce 4 messages, 2 media markers and 2 links in one message  | Chat Analyzer                        |
| `/whatsapp/guides/word-and-emoji-analysis/`           | Understand lexical and emoji occurrence rules   | Two fictional texts yield `lantern: 3`, `trail: 2`, `😊: 3`                            | Chat Analyzer                        |
| `/whatsapp/guides/compare-chat-exports/`              | Compare saved full-export aggregates safely     | 100→130 messages; 20%→30% hour share; limits on interpreting subtraction               | Chat Vault; Analyzer for saving      |
| `/whatsapp/guides/backup-and-restore-chat-snapshots/` | Preserve and restore saved summaries            | Included/excluded data table; validation and explicit import confirmation              | Chat Vault                           |
| `/whatsapp/guides/create-whatsapp-wrapped/`           | Produce and review a shareable deck             | Existing synthetic demo totals: 24 messages, 8 active dates, 3 labels, 4 media markers | Wrapped                              |
| `/whatsapp/guides/chat-export-not-working/`           | Diagnose an import or coverage problem          | Symptom/meaning/action table; `03/04/2026` ambiguity                                   | Chat Analyzer / Doctor               |
| `/whatsapp/guides/chat-analysis-privacy/`             | Understand processing, retention and sharing    | Memory versus explicit local snapshots versus downloaded files                         | Chat Analyzer; privacy page          |

Group interpretation is separate from obtaining a file. The activity guide
explains time buckets; message/media explains denominators; word/emoji explains
tokenization and sensitive vocabulary. Comparison reads existing saved summaries,
while backup moves validated summaries between local stores. Wrapped teaches
review/export, troubleshooting handles rejected or partial inputs, and privacy
explains data lifetime. These are different tasks rather than interchangeable
landing-page wording.

## Source and product truth

- `parser.ts`, `detection.ts`, `headers.ts`, `timestamp.ts`, `limits.ts` and the
  import UI establish one UTF-8 TXT or a supported ZIP with exactly one chat TXT,
  explicit format confirmation, numeric date-order ambiguity and bounded input.
  Verified formats do not establish complete WhatsApp history or all locales.
- `analysis.ts`, `filters.ts` and `content-analysis.ts` establish participant
  messages versus system events, local view filters, active-date denominators,
  marker counts and the 7×24 recorded-clock heatmap. No timezone or online state
  is inferred. A selected label does not inherit senderless system events.
- `events.ts` recognizes exact supported markers. Attachments are not inspected;
  unknown media, deleted contents and call duration/direction are not inferred.
- `text-analysis.ts` and `stopwords.ts` apply the combined Turkish, German and
  English stopword lists, recognized URL/email removal, 2–40-code-point tokens,
  at least two occurrences and top-20 display. Bare domains can remain text.
  Emoji availability depends on supported browser segmentation. These are not
  sentiment, personality or relationship analyses.
- `rhythm.ts` describes threshold-defined sessions and recorded adjacency, not
  verified replies. Participant-only filtering disables conversation-relative
  rhythm. No new calculations are introduced by these guides.
- `stories.ts`, `story-types.ts`, `wrapped.tsx` and `wrapped-canvas.ts` use the full
  accepted export, evidence-gated cards, anonymous aliases and 1080×1920 artwork.
  Optional words are off by default and can reveal vocabulary when enabled.
  Group presentation starts at three exported labels, not verified identities;
  ties and undisplayed ranking participants remain disclosed.
- `chat-vault.ts`, `chat-vault-storage.ts`, `chat-vault-compare.ts` and the Vault UI
  establish deliberate full-export aggregate saves, no persisted participant or
  conversation identity, bounded 2 MiB backup input, preview/confirmation before
  restore, and explicit same-conversation confirmation before comparison.
  Aggregate deltas do not identify newly sent messages or causes. A Vault backup
  is not a WhatsApp/iCloud/Google Drive backup and cannot restore a transcript.
- `demo.ts` is the source of the 24/8/3/4 public demo example. Other miniature
  examples were authored synthetically and do not derive from private exports.
- The privacy guide preserves INS-134's distinction between local chat analysis
  and the shared bounded aggregate document-entry event. It does not claim that
  visiting a hosted website makes no network requests.

Official export guidance checked on 17 October 2026:
[WhatsApp Android export instructions](https://faq.whatsapp.com/1180414079177245/?cms_platform=android)
support the named Android menu path, media choice and the distinction between a
text export and a restorable WhatsApp backup. The official
[iPhone help destination](https://faq.whatsapp.com/1180414079177245/?cms_platform=iphone)
was reachable but its full platform-specific text was unavailable through the
research reader. The article links it and avoids claiming an unverified exact
iPhone menu path. No third-party tutorial is treated as format evidence.

## Delivery contract

`src/lib/whatsapp/guide-content.ts` contains only public editorial data and a
type-only Article import; it cannot read an active chat. Existing article
rendering supplies headings, tables, ordered steps, source links and primary
actions. Each guide links to the hub, its working tool and relevant guides.

The shared public route policy owns metadata and sitemap registration. Production
public pages must have self-canonicals and consistent indexing signals; preview
and unknown contexts remain blocked. This document does not certify those checks:
record final-output, hosted-preview and post-owner-deployment results in the
coordinated INS-154 handoff. Successful builds and sitemap inclusion do not prove
that Google indexed a page or that Instagram impressions recovered.
