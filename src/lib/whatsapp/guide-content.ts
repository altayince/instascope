import type { Article } from "../articles.ts";

/** Public editorial content only. Examples are fictional, never loaded chat data. */
export const whatsappGuides: Record<string, Article> = {
  "export-whatsapp-chat": {
    title: "How to Export a WhatsApp Chat for Local Analysis",
    description:
      "Export one WhatsApp conversation as text, then open its TXT or ZIP in InstaScope. Review the recorded format before analyzing it locally.",
    primaryAction: {
      href: "/whatsapp/chat-analyzer/",
      label: "Open your chat export",
    },
    sections: [
      {
        heading: "Start with a chat export, not a cloud backup",
        paragraphs: [
          "Use WhatsApp's chat-export feature to save a text copy of one conversation, then open that TXT or its ZIP in InstaScope. You do not need to connect your WhatsApp account. An iCloud or Google Drive backup is a different format and cannot be opened here.",
          "WhatsApp's Android instructions currently place Export chat under More options, then More. Choose Without media for a smaller file: InstaScope reads text records and supported media markers, not attachment contents. On iPhone, consult the official iPhone export instructions linked below; menu placement and available options can vary.",
        ],
        steps: [
          "Open the conversation in WhatsApp and use its Export chat action.",
          "Save the export to a location you control on your device. Avoid sending a private chat to an unrelated service just to move the file.",
          "In Chat Analyzer, choose Open chat export and select one TXT or one ZIP containing exactly one chat TXT.",
          "Review the detected timestamp format, choose the date order if it is ambiguous, then select Confirm format and open chat.",
        ],
      },
      {
        heading: "A fictional format check",
        paragraphs: [
          "These invented headers illustrate why the format review matters. Numeric dates can have more than one valid reading; your browser's language does not resolve that ambiguity.",
        ],
        table: {
          columns: ["Synthetic header", "What must be established"],
          rows: [
            [
              "03/04/2026, 09:15 - Example A: Hello",
              "3 April or 4 March: confirm the source date order",
            ],
            [
              "[2026-04-13, 09:15:02] Example B: Hello",
              "Year-month-day, bracket wrapper, seconds recorded",
            ],
          ],
        },
      },
      {
        heading: "Check what actually arrived",
        paragraphs: [
          "After import, compare the first and latest recorded dates with the period you expected. An export is supplied evidence, not a guarantee that every historical message is included. The Chat Export Doctor explains supported structures, skipped preamble and unclassified markers.",
          "Split or combined conversations are not merged automatically. ZIPs with several TXT candidates are rejected rather than guessed. Keep the original export unchanged; if a format is unsupported, use the troubleshooting guide instead of editing dates until they pass.",
          "Parsing stays in your browser. The working chat is removed on reload or clear. A Chat Vault save preserves only selected aggregates, so retain your original file privately if you want to reopen the analysis later. WhatsApp also explains that a text export is not a backup that can be re-imported into WhatsApp.",
        ],
      },
    ],
    links: [
      { href: "/whatsapp/guides/", label: "All WhatsApp guides" },
      {
        href: "/whatsapp/guides/chat-export-not-working/",
        label: "Troubleshoot an export that will not open",
      },
      {
        href: "/whatsapp/guides/chat-analysis-privacy/",
        label: "Understand local chat privacy",
      },
    ],
    related: [
      "whatsapp/guides/chat-export-not-working",
      "whatsapp/guides/chat-analysis-privacy",
    ],
    sources: [
      {
        href: "https://faq.whatsapp.com/1180414079177245/?cms_platform=android",
        label: "WhatsApp Help Center: export chat history on Android",
      },
      {
        href: "https://faq.whatsapp.com/1180414079177245/?cms_platform=iphone",
        label: "WhatsApp Help Center: export chat history on iPhone",
      },
    ],
  },
  "analyze-group-chat": {
    title: "How to Analyze a WhatsApp Group Chat Export",
    description:
      "Compare exported participant message counts, activity and media in a WhatsApp group chat. Keep ties, source coverage and participant-label limits clear.",
    primaryAction: {
      href: "/whatsapp/chat-analyzer/",
      label: "Analyze a group chat export",
    },
    sections: [
      {
        heading: "Count what each exported label contributed",
        paragraphs: [
          "Open a group chat's text export in Chat Analyzer to compare participant message counts, recorded activity, recognized media and supported emoji. InstaScope uses group presentation when the loaded export contains three or more participant labels. That is a presentation rule, not verification of a WhatsApp group's membership.",
          "Labels are grouped exactly as the export supplies them. A changed contact label may therefore appear separately; InstaScope does not merge identities or infer who joined or left. People who have no messages in the supplied file cannot be reconstructed from these counts.",
        ],
        steps: [
          "Open one group's TXT or supported ZIP and confirm its date format.",
          "Read the Chat Export Doctor's coverage summary before comparing counts.",
          "Keep Everyone selected to compare the whole selected date range, or choose one label to inspect only its attributable messages.",
          "Use the participant list's pagination to inspect every exported label; the denominator includes off-page labels too.",
        ],
      },
      {
        heading: "A tie is a tie: a fictional 24-message group",
        paragraphs: [
          "Suppose three invented labels each contribute eight messages. All three tie at the same count. Their displayed shares are rounded, so the visible percentages need not add to exactly 100%.",
        ],
        table: {
          columns: ["Fictional exported label", "Messages", "Share of 24"],
          rows: [
            ["Example A", "8", "33.3%"],
            ["Example B", "8", "33.3%"],
            ["Example C", "8", "33.3%"],
          ],
        },
      },
      {
        heading: "Read activity without assigning motives",
        paragraphs: [
          "The activity calendar and weekday/hour charts show when included messages were recorded. Senderless system events do not inflate participant message counts. Selecting one participant also excludes system events that cannot be attributed to that label.",
          "A long gap after filtering describes the absence of that label's included messages, not silence across the group. Conversation-relative rhythm requires Everyone; adjacent messages do not establish replies, interest or responsiveness.",
          "Analysis runs locally, including participant names and word lists. If you want a shareable summary, open Wrapped: default cards use anonymous aliases, disclose ties and cap visible group rankings while retaining whole-population totals. Review the artwork before sharing; even anonymous statistics may reveal context.",
        ],
        links: [
          { href: "/whatsapp/wrapped/", label: "Make group Wrapped cards" },
        ],
      },
    ],
    links: [
      { href: "/whatsapp/guides/", label: "All WhatsApp guides" },
      {
        href: "/whatsapp/guides/chat-activity-heatmap/",
        label: "Read the weekday and hour heatmap",
      },
      {
        href: "/whatsapp/guides/create-whatsapp-wrapped/",
        label: "Share a factual Wrapped",
      },
    ],
    related: [
      "whatsapp/guides/chat-activity-heatmap",
      "whatsapp/guides/create-whatsapp-wrapped",
    ],
  },
  "chat-activity-heatmap": {
    title: "How to Read a WhatsApp Chat Activity Heatmap",
    description:
      "See which recorded weekdays and hours contain your exported WhatsApp messages. Filter the 7 × 24 heatmap without inferring timezone or online presence.",
    primaryAction: {
      href: "/whatsapp/chat-analyzer/",
      label: "Explore your chat activity",
    },
    sections: [
      {
        heading: "A map of recorded messages, not online status",
        paragraphs: [
          "InstaScope's chat activity heatmap counts exported participant messages in seven weekday rows and 24 hour columns. A cell answers how many included messages have that recorded weekday and hour. It cannot show when someone was online, reading your chat or available to reply.",
          "The original calendar and clock fields determine placement. InstaScope does not infer a timezone from your device or convert the export into UTC. A message recorded at 09:45 belongs to the 09 column, even if you open the file in another country.",
        ],
        steps: [
          "Open and confirm your export in Chat Analyzer, then find activity by recorded weekday and hour.",
          "Use All time, a year, a month or an inclusive custom date range to select the records you want.",
          "Keep Everyone for all included participant messages, or select one exported label.",
          "Use the cell labels or Read weekday and hour values for exact counts without relying on color.",
        ],
      },
      {
        heading: "Place three fictional messages on the grid",
        paragraphs: [
          "In this small invented export, two Monday messages occupy the same hour cell. Tuesday's message occupies a different row and column. No other activity needs to be guessed.",
        ],
        table: {
          columns: ["Recorded message time", "Heatmap contribution"],
          rows: [
            ["Monday, 2 February 2026, 09:10", "Monday / 09: +1"],
            ["Monday, 2 February 2026, 09:45", "Monday / 09: +1, total 2"],
            ["Tuesday, 3 February 2026, 18:05", "Tuesday / 18: +1"],
          ],
        },
      },
      {
        heading: "Compare counts before comparing colors",
        paragraphs: [
          "Color intensity scales to the largest cell in the current filtered subset. Changing filters can therefore change a cell's shade even when its count stays the same. Read the exact number when comparing views. The weekday and hour charts summarize the same included messages along one dimension.",
          "System events are separate and do not populate this message heatmap. A zero cell means no matching participant messages in the supplied records, not proof that nobody communicated then. Missing history and partial export coverage remain unknown.",
          "Filters update local analysis without changing the accepted export or Chat Export Doctor. Reset filters to return to the full supplied dataset; Wrapped and saved Chat Vault snapshots use the full export rather than this temporary view.",
        ],
      },
    ],
    links: [
      { href: "/whatsapp/guides/", label: "All WhatsApp guides" },
      {
        href: "/whatsapp/guides/analyze-group-chat/",
        label: "Interpret participant counts",
      },
      {
        href: "/whatsapp/guides/compare-chat-exports/",
        label: "Compare saved activity distributions",
      },
    ],
    related: [
      "whatsapp/guides/analyze-group-chat",
      "whatsapp/guides/compare-chat-exports",
    ],
  },
  "message-and-media-statistics": {
    title: "WhatsApp Message and Media Statistics Explained",
    description:
      "Count exported messages, recognized media markers and link occurrences locally. Understand why media totals differ from attachments and messages containing links.",
    primaryAction: {
      href: "/whatsapp/chat-analyzer/",
      label: "Inspect message and media counts",
    },
    sections: [
      {
        heading: "Different totals answer different questions",
        paragraphs: [
          "Chat Analyzer counts supplied participant messages, recognized media messages and link occurrences separately. A text export can support these counts without giving InstaScope access to the original photos, voice recordings or videos. The tool never opens attachments to decide what they contain.",
          "Media categories come from supported complete omission markers, including recognized image, video, audio, sticker, GIF and document markers. A generic Media omitted marker remains unspecified. Unknown or caption-bearing variants are not promoted to a guessed media type; the Doctor reports relevant unclassified markers.",
        ],
      },
      {
        heading: "Four fictional records, three different totals",
        paragraphs: [
          "Consider these four invented participant messages. The two example.org links are synthetic. Their occurrence count does not represent two people, two visits or two unique domains.",
        ],
        table: {
          columns: [
            "Synthetic record body",
            "Participant messages",
            "Recognized media",
            "Link occurrences",
          ],
          rows: [
            ["image omitted", "1", "1 image", "0"],
            ["video omitted", "1", "1 video", "0"],
            ["https://example.org/a https://example.org/b", "1", "0", "2"],
            ["A fictional plain-text note", "1", "0", "0"],
            ["Total", "4", "2", "2 in one message"],
          ],
        },
      },
      {
        heading: "Use the right scope and denominator",
        paragraphs: [
          "Open your export, confirm the format and inspect the filtered overview. Date and participant controls update the overview, activity charts and media/link/emoji counts together. Messages per active date divides matching participant messages by dates with at least one matching message, not every date on the calendar.",
          "Senderless system records remain separate. Recognized call markers are counted only where supported source structure supplies them; no call duration or direction is inferred. With one participant selected, unassigned system events cannot be credited to that participant.",
        ],
        steps: [
          "Start with Everyone and All time to inspect the full supplied export.",
          "Read the Doctor if a media total looks unexpectedly low.",
          "Apply a date range or participant label and check the active filter summary before interpreting the new totals.",
        ],
      },
      {
        heading: "What an empty category does not prove",
        paragraphs: [
          "Zero recognized images does not prove nobody sent a photo: that category's markers may be absent or unsupported in this file. Missing records are not recovered, and links are counted locally without visiting their destinations.",
          "Your messages, marker text and participant labels remain in browser memory. Default Wrapped cards summarize eligible totals with anonymous labels; saving to Chat Vault retains approved aggregates without attachments or message bodies.",
        ],
      },
    ],
    links: [
      { href: "/whatsapp/guides/", label: "All WhatsApp guides" },
      {
        href: "/whatsapp/guides/word-and-emoji-analysis/",
        label: "Understand word and emoji occurrences",
      },
      {
        href: "/whatsapp/guides/chat-export-not-working/",
        label: "Check export coverage and unsupported markers",
      },
    ],
    related: [
      "whatsapp/guides/word-and-emoji-analysis",
      "whatsapp/guides/chat-export-not-working",
    ],
  },
  "word-and-emoji-analysis": {
    title: "How WhatsApp Word and Emoji Analysis Works",
    description:
      "Explore repeated words and supported emoji occurrences in a local WhatsApp export. Learn the filtering rules and keep sensitive words out of shared cards.",
    primaryAction: {
      href: "/whatsapp/chat-analyzer/",
      label: "Explore words and emoji locally",
    },
    sections: [
      {
        heading: "Find repeated words without uploading your conversation",
        paragraphs: [
          "Chat Analyzer shows frequent eligible words and supported emoji occurrences from your selected WhatsApp records. Both calculations run in your browser. The results describe written content; they do not classify emotions, personalities or the quality of a relationship.",
          "Word analysis uses ordinary nonempty participant text, excluding recognized media and event records. It normalizes case, removes recognized URL and email tokens, then filters a combined Turkish, German and English stopword list. It does not guess the conversation's language or merge word stems.",
        ],
      },
      {
        heading: "A tiny fictional word and emoji example",
        paragraphs: [
          "Imagine two invented messages: Lantern lantern trail 😊 and Trail lantern 😊😊. With a browser that supports the required emoji segmentation, the results below follow directly. Repetition inside one message counts more than once.",
        ],
        table: {
          columns: ["Result", "Count", "Interpretation"],
          rows: [
            [
              "lantern",
              "3",
              "Eligible word occurrences after case normalization",
            ],
            ["trail", "2", "Eligible word occurrences"],
            ["😊", "3", "Emoji occurrences across two messages"],
            [
              "Messages containing emoji",
              "2",
              "Messages, not individual emoji",
            ],
          ],
        },
      },
      {
        heading: "Why a word may be absent",
        paragraphs: [
          "Displayed top words must contain 2–40 Unicode code points and occur at least twice. The list and word cloud show at most 20 words, ordered by count with deterministic spelling tie-breaks. A word occurring once can contribute to eligible-word totals without appearing in that list.",
          "Numbers, punctuation and emoji are not word tokens. Stopwords from all three supported lists apply together, so a token can be removed because it is common in another language. Some bare domains without a recognized URL prefix can remain ordinary text; this is filtering, not a guarantee that all sensitive terms disappear.",
          "Date and participant filters change the selected text locally. Cross-participant disproportionate-word comparisons require additional evidence and are unavailable for a single selected label. An unavailable result is not a zero or a personality finding.",
        ],
      },
      {
        heading: "Keep private vocabulary out of shared images",
        paragraphs: [
          "Emoji counts stay unavailable when the browser cannot provide the supported segmentation; InstaScope does not replace them with zero. Neither emoji nor word counts establish sentiment.",
          "Wrapped excludes word-based insights by default. Its separate opt-in can expose a small qualifying word selection in downloaded artwork, so review every card before sharing. The two-message example above is enough for Analyzer word counts, but does not satisfy Wrapped's stronger word-card evidence rules. Chat Vault never stores lexical words or emoji glyphs.",
        ],
      },
    ],
    links: [
      { href: "/whatsapp/guides/", label: "All WhatsApp guides" },
      {
        href: "/whatsapp/guides/create-whatsapp-wrapped/",
        label: "Review Wrapped sharing controls",
      },
      {
        href: "/whatsapp/guides/chat-analysis-privacy/",
        label: "See what stays local",
      },
    ],
    related: [
      "whatsapp/guides/create-whatsapp-wrapped",
      "whatsapp/guides/chat-analysis-privacy",
    ],
  },
  "compare-chat-exports": {
    title: "How to Compare Two WhatsApp Chat Exports",
    description:
      "Save two local aggregate snapshots and compare their recorded counts and activity. Confirm the conversation yourself and read differences without inventing new messages.",
    primaryAction: {
      href: "/whatsapp/chat-vault/",
      label: "Compare saved chat snapshots",
    },
    sections: [
      {
        heading: "Compare saved summaries, not reconstructed message history",
        paragraphs: [
          "To compare WhatsApp exports in InstaScope, import each file separately and save its full-export aggregate snapshot to Chat Vault. Select those two saved snapshots and confirm that they describe the same conversation. Comparison reads the saved summaries locally; it does not match message bodies or identify messages added between exports.",
          "The Vault deliberately stores no conversation identity or participant mapping. Similar counts or matching date ranges cannot establish a match automatically. You are responsible for choosing the correct pair, even when both files came from the same device.",
        ],
        steps: [
          "Open the first export in Chat Analyzer, confirm its format and choose Save to Chat Vault.",
          "Open the other export and save a second snapshot. Temporary Analyzer filters are not saved.",
          "In Chat Vault, select two different snapshots, check their coverage, confirm the same conversation and choose Compare snapshots.",
          "Read the compatibility notes before reviewing totals, distributions and Conversation Pulse.",
        ],
      },
      {
        heading: "A fictional count change and a share change",
        paragraphs: [
          "These invented summaries illustrate two different comparisons. The raw count difference is factual about the saved totals; it is not a count of newly sent messages.",
        ],
        table: {
          columns: ["Metric", "Earlier summary", "Later summary", "Difference"],
          rows: [
            ["Exported messages", "100", "130", "+30 in saved totals"],
            [
              "Messages in the 09 hour",
              "20 of 100 (20%)",
              "39 of 130 (30%)",
              "+10 percentage points of each export",
            ],
          ],
        },
      },
      {
        heading: "Coverage can explain a difference without proving its cause",
        paragraphs: [
          "Different starting dates, equal ending dates, non-overlapping coverage, partial support or different timestamp precision limit interpretation. The interface explains these conditions instead of silently treating the snapshots as a continuous history. Display order normally follows recorded coverage end; save-time or stable-ID fallbacks are identified when needed.",
          "Hour and weekday shares divide by each snapshot's own message total. Empty denominators and unavailable values remain unavailable. Neither a bigger total nor a shorter recorded gap proves increased interest, faster replies or a relationship change.",
          "Conversation Pulse selects a small set of supported aggregate differences using explained display thresholds. It may show no meaningful change. These thresholds are not statistical confidence, and Pulse does not infer causes. All comparison selections and results remain on this device; no public chat URL is created.",
        ],
      },
    ],
    links: [
      { href: "/whatsapp/guides/", label: "All WhatsApp guides" },
      {
        href: "/whatsapp/chat-analyzer/",
        label: "Open an export to save a snapshot",
      },
      {
        href: "/whatsapp/guides/backup-and-restore-chat-snapshots/",
        label: "Keep a local backup of saved summaries",
      },
    ],
    related: [
      "whatsapp/guides/backup-and-restore-chat-snapshots",
      "whatsapp/guides/chat-activity-heatmap",
    ],
  },
  "backup-and-restore-chat-snapshots": {
    title: "How to Back Up and Restore InstaScope Chat Snapshots",
    description:
      "Download and restore a local JSON backup of Chat Vault aggregates. This preserves saved summaries, not WhatsApp messages, media or a cloud backup.",
    primaryAction: {
      href: "/whatsapp/chat-vault/",
      label: "Open Chat Vault backup controls",
    },
    sections: [
      {
        heading: "Back up the summaries you deliberately saved",
        paragraphs: [
          "Chat Vault can download a JSON backup of your saved WhatsApp aggregate snapshots and restore that file into the local Vault. It cannot back up or restore a WhatsApp conversation, iCloud backup, Google Drive backup or message attachments. The raw chat is not part of a saved snapshot.",
          "Snapshots live in this browser's storage and can disappear when you clear site data or lose access to the device. Downloading a backup is a deliberate local action, not automatic cloud synchronization. Keep the file somewhere private: dates and aggregate counts can still be sensitive.",
        ],
        steps: [
          "After importing a real export, use Save to Chat Vault. A fictional demo cannot be saved as your own snapshot.",
          "Open Chat Vault and choose Export Chat Vault backup to download the validated summaries.",
          "To restore, choose Import Chat Vault backup and select the JSON file.",
          "Review the preview of new and existing snapshots. Nothing is written until you choose Confirm import.",
        ],
      },
      {
        heading: "What survives a fictional save and restore",
        paragraphs: [
          "This invented example describes fields in a saved summary, not a ready-to-import backup file. The restore process preserves the approved aggregates without reconstructing the original chat.",
        ],
        table: {
          columns: ["Example information", "In the backup?"],
          rows: [
            [
              "120 exported messages across 10 active dates",
              "Yes, as aggregate counts",
            ],
            ["Recorded date coverage and hourly distribution", "Yes"],
            ["Participant names, message text or attachments", "No"],
            ["Words, emoji glyphs or a conversation identity", "No"],
          ],
        },
      },
      {
        heading: "Restore rules protect existing entries",
        paragraphs: [
          "The supported backup input is bounded to 2 MiB and 100 unique snapshots. Unknown versions, extra fields, invalid values or inconsistent distributions are rejected before writing. Existing local snapshot IDs are kept rather than overwritten; an identical ID is not evidence that two exports describe the same conversation.",
          "If the app reports an unreadable stored entry, do not assume a complete backup succeeded. Backup avoids silently dropping corrupt rows; review the warning and remove an unreadable entry only if you intend that deletion. Storage failures leave the currently loaded analysis available.",
          "Restored snapshots can be compared after explicit selection and same-conversation confirmation. They cannot reopen participant lists or recover a transcript. Keep the original text export separately if you need to analyze its messages again.",
        ],
      },
    ],
    links: [
      { href: "/whatsapp/guides/", label: "All WhatsApp guides" },
      {
        href: "/whatsapp/guides/compare-chat-exports/",
        label: "Compare restored aggregate snapshots",
      },
      {
        href: "/whatsapp/guides/chat-analysis-privacy/",
        label: "Understand storage and downloaded files",
      },
    ],
    related: [
      "whatsapp/guides/compare-chat-exports",
      "whatsapp/guides/chat-analysis-privacy",
    ],
  },
  "create-whatsapp-wrapped": {
    title: "How to Make WhatsApp Wrapped Cards from Your Chat Export",
    description:
      "Turn a local WhatsApp export into factual portrait cards. Review anonymous summaries, save individual PNGs or download the available deck as a ZIP.",
    primaryAction: {
      href: "/whatsapp/wrapped/",
      label: "Make your WhatsApp Wrapped",
    },
    sections: [
      {
        heading: "Make cards from recorded facts, without connecting WhatsApp",
        paragraphs: [
          "Open a supported WhatsApp chat export in InstaScope Wrapped to make portrait cards from its recorded activity and message statistics. Review a card, download its PNG, or export the available deck as a ZIP. Rendering happens in your browser; you do not upload the chat to a remote image service.",
          "Wrapped uses the full accepted export. Changing a year or participant filter in Analyzer does not secretly change the cards. The deck selects only stories supported by enough supplied evidence, so sparse exports can produce fewer cards instead of fabricated highlights.",
        ],
        steps: [
          "Open your TXT or supported ZIP and confirm its date format, or try the clearly labeled fictional demo.",
          "Move through the cards with the available controls or keyboard. Open How this is calculated to inspect a card's definition and limits.",
          "Choose Download PNG for a 1080 × 1920 image, or Export full deck for the locally rendered PNG collection.",
          "Use Share card where your device supports file sharing; otherwise save the PNG and share it yourself.",
        ],
      },
      {
        heading: "What the existing fictional demo can show",
        paragraphs: [
          "These source totals come from InstaScope's synthetic demo, not a person's conversation. The available deck draws on these and other supported calculations; it does not promise one card for every row.",
        ],
        table: {
          columns: ["Demo fact", "Value", "Honest interpretation"],
          rows: [
            [
              "Exported participant messages",
              "24",
              "Messages in the fictional file",
            ],
            ["Active recorded dates", "8", "Dates with at least one message"],
            [
              "Participant labels",
              "3",
              "Group presentation, not verified people",
            ],
            [
              "Recognized media markers",
              "4",
              "Markers, not inspected attachments",
            ],
          ],
        },
      },
      {
        heading: "Review privacy before pressing Share",
        paragraphs: [
          "Default cards use anonymous participant aliases and aggregate facts instead of names, message bodies, URLs or attachment filenames. Group rankings disclose ties and labels outside the displayed rows. Anonymous does not mean context-free: dates and patterns may still be recognizable to someone who knows the conversation.",
          "Include word-based insights in Wrapped is off by default. Turning it on can put qualifying conversation words into the artwork, so inspect that card especially carefully. The option does not guarantee a word card when evidence is insufficient.",
          "Recorded gaps and next-message timing are not proof of replies, read receipts or relationship quality. Downloading or sharing creates a file outside the app's control; choose its destination deliberately. Clearing or replacing the source cancels a pending full-deck export rather than downloading stale cards.",
        ],
      },
    ],
    links: [
      { href: "/whatsapp/guides/", label: "All WhatsApp guides" },
      {
        href: "/whatsapp/guides/export-whatsapp-chat/",
        label: "Get the right chat export",
      },
      {
        href: "/whatsapp/guides/word-and-emoji-analysis/",
        label: "Understand optional word insights",
      },
    ],
    related: [
      "whatsapp/guides/export-whatsapp-chat",
      "whatsapp/guides/word-and-emoji-analysis",
    ],
  },
  "chat-export-not-working": {
    title: "WhatsApp Chat Export Not Working? Check Format and Coverage",
    description:
      "Troubleshoot rejected files, ambiguous dates and partially supported WhatsApp exports. Use Chat Export Doctor without sharing private message samples.",
    primaryAction: {
      href: "/whatsapp/chat-analyzer/",
      label: "Check your export locally",
    },
    sections: [
      {
        heading: "Start with the specific import message",
        paragraphs: [
          "If a WhatsApp export will not open, check the file selection and detected timestamp format first. InstaScope accepts one UTF-8 TXT or one supported ZIP containing exactly one chat TXT. It deliberately rejects ambiguous archive choices and unsupported formats instead of creating plausible-looking but incorrect results.",
          "A failed replacement does not discard the previously accepted chat. Cancel the new import or choose another file; do not assume an error means your existing analysis has been overwritten. Keep your original export unchanged while investigating.",
        ],
      },
      {
        heading: "Match the symptom to the next action",
        paragraphs: [
          "The examples below are synthetic. Do not post real filenames, sender labels or message bodies in a public bug report.",
        ],
        table: {
          columns: ["Symptom", "Meaning", "Next action"],
          rows: [
            [
              "ZIP contains two TXT files",
              "The chat candidate is ambiguous",
              "Select the intended extracted chat TXT alone",
            ],
            [
              "03/04/2026 could use two date orders",
              "Both 3 April and 4 March fit",
              "Confirm the order used by the source; do not guess from browser locale",
            ],
            [
              "Unsupported or mixed timestamp header",
              "The record boundary cannot be parsed safely",
              "Export a fresh file with supported numeric dates; retain the original",
            ],
            [
              "Partially supported",
              "Some source structure or markers have limits",
              "Read the Doctor's visible warnings and detailed evidence",
            ],
          ],
        },
      },
      {
        heading: "Supported is not the same as complete",
        paragraphs: [
          "After successful import, Chat Export Doctor keeps Supported or Partially supported visible. Expand Format details and source limitations to inspect wrapper, date order, year width, clock precision, recognized event types and ignored companion counts. Warnings about skipped preamble and unclassified markers remain important even when useful analysis is available.",
          "Supported describes recognized structure, not proof that WhatsApp included your entire history. Compare the observed first and latest message dates with what you expected. Named months, translated AM/PM or a different wrapper may need verified parser support; changing a filename cannot add it.",
        ],
      },
      {
        heading: "Large or damaged files need a different input",
        paragraphs: [
          "Chat text is limited to 20 MiB and ZIP input to 1 GiB, with additional archive and record safety limits. A phone may still struggle below those ceilings. Try exporting without media to avoid unnecessary attachments; encrypted, multipart, ZIP64 or damaged ZIPs are not supported.",
          "All inspection runs locally. If the issue persists, report the fixed error wording and non-identifying structural facts, such as numeric date order and whether brackets are present. Use a tiny invented record to demonstrate the shape. Never submit your private chat to a public issue or treat an unsupported marker as evidence of a recovered message.",
        ],
      },
    ],
    links: [
      { href: "/whatsapp/guides/", label: "All WhatsApp guides" },
      {
        href: "/whatsapp/guides/export-whatsapp-chat/",
        label: "Export a suitable chat file",
      },
      {
        href: "/whatsapp/guides/message-and-media-statistics/",
        label: "Understand missing media counts",
      },
    ],
    related: [
      "whatsapp/guides/export-whatsapp-chat",
      "whatsapp/guides/message-and-media-statistics",
    ],
  },
  "chat-analysis-privacy": {
    title: "WhatsApp Chat Analysis Privacy: What Stays on Your Device",
    description:
      "Understand local chat processing, optional aggregate storage and deliberate sharing in InstaScope. No WhatsApp login or remote chat-analysis service is required.",
    primaryAction: {
      href: "/whatsapp/chat-analyzer/",
      label: "Try local chat analysis",
    },
    sections: [
      {
        heading: "Your chat is processed in the browser",
        paragraphs: [
          "InstaScope reads and analyzes the WhatsApp export you choose on your device. It does not ask you to sign in to WhatsApp or send the chat to a remote analysis or AI service. Participant labels, message text, words and activity calculations stay local.",
          "Loading the website still requests its application assets, and the shared site may send its documented bounded aggregate entry event. That event does not contain the chat, names, words, archive contents or a chat identifier. Local processing is not a claim that visiting a hosted website creates no network traffic at all.",
        ],
      },
      {
        heading: "Three different lifetimes for a fictional chat",
        paragraphs: [
          "Suppose an invented export contains 120 messages. Its active analysis, an optional saved snapshot and a downloaded card are different things with different lifetimes.",
        ],
        table: {
          columns: ["Action", "What remains", "Where"],
          rows: [
            [
              "Open and analyze",
              "Working records and derived results until clear or reload",
              "This tab's memory",
            ],
            [
              "Explicitly save to Chat Vault",
              "Approved aggregate summary, without messages or identities",
              "This browser's local storage",
            ],
            [
              "Download a Wrapped PNG or Vault backup",
              "The file you chose to create",
              "Your chosen download/share destination",
            ],
          ],
        },
      },
      {
        heading: "Saving a snapshot does not preserve the conversation",
        paragraphs: [
          "Chat Vault retains selected numeric summaries, source date coverage and defined activity distributions only after you save. It stores no participant names, message bodies, words, emoji glyphs, URLs or conversation fingerprint. The snapshot cannot reopen the raw chat.",
          "Reloading clears the working chat but does not delete deliberately saved Vault entries. Clearing site data can remove those entries, while deleting a Vault snapshot does not erase a backup you already downloaded. Backups are manual files, not cloud synchronization.",
        ],
      },
      {
        heading: "Sharing remains your decision",
        paragraphs: [
          "Default Wrapped cards use aggregate facts and anonymous aliases. Optional word-based insights can expose conversation vocabulary, and even anonymous dates or counts may be recognizable. Review each card and its sharing destination before sending it.",
          "Chats include other people's words too. Only analyze files you are entitled to use, and consider their privacy before sharing a summary. The tool makes no personality judgments, reconstructs no deleted content and creates no public per-chat result page. For the site's complete analytics and storage explanation, read the privacy page.",
        ],
        links: [
          { href: "/privacy/", label: "Read InstaScope's privacy details" },
        ],
      },
    ],
    links: [
      { href: "/whatsapp/guides/", label: "All WhatsApp guides" },
      {
        href: "/whatsapp/guides/backup-and-restore-chat-snapshots/",
        label: "Understand local snapshot backups",
      },
      {
        href: "/whatsapp/guides/create-whatsapp-wrapped/",
        label: "Review cards before sharing",
      },
    ],
    related: [
      "whatsapp/guides/backup-and-restore-chat-snapshots",
      "whatsapp/guides/create-whatsapp-wrapped",
    ],
  },
};
