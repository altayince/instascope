# HTML connection records

INS-104 fixes existing HTML import compatibility for the six supported optional
connection categories. It does not add export categories or change JSON parsing.

## Verified local failure

A locally available real Meta HTML export was inspected without uploading it or
copying personal values into fixtures, logs or documentation. Before the fix,
all six present optional categories failed the existing HTML parser.

Followers uses profile anchors inside individual Meta cards. Following adds an
account heading and commonly uses `https://www.instagram.com/_u/USERNAME`.
The optional categories instead contain **labelled tables without profile
anchors**. Their nested cards have this shape:

```html
<main class="_a706">
  <div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">
    <div class="_3-95 _a6-p">
      <div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">
        <div class="_a6-p">
          <table>
            <tr>
              <td class="_a6_q">Username</td>
              <td class="_2piu _a6_r">synthetic.example</td>
            </tr>
          </table>
        </div>
      </div>
    </div>
    <div class="_3-94 _a6-o">Jan 02, 2025 1:05 pm</div>
  </div>
</main>
```

This example uses synthetic identity/date values. Real records include optional
`Name` and `URL` fields in varying order. Some URL values are stale or do not
point to Instagram. An explicit `Username` is authoritative, matching existing
JSON `label_values` behavior. A username-shaped display `Name` is never identity
evidence. The date is outside the inner table, on the outer record card.

The previous parser only looked for anchors and assumed each direct `<main>`
child was exactly one account. It therefore could not read label tables and
rejected additional wrappers containing multiple independent profile records.

## Supported records and safeguards

- Followers/Following profile records, including nested wrappers, headings and
  normal or `/_u/` Instagram profile URLs.
- Optional labelled account tables for Close friends, Blocked accounts,
  Restricted accounts, Story hidden from, Pending requests and Your unfollow
  history.
- Direct HTML files and ZIP-contained files, including supported numeric suffixes
  and split follower files.
- Per-record dates using the existing strict English
  `MMM DD, YYYY h:mm am|pm` parser. Missing/malformed dates leave the account's
  date unavailable. HTML precision remains `minute-without-timezone`.

Record ownership prevents dates or identities leaking across adjacent cards.
Ambiguous/malformed records remain errors; an optional list is not presented as
complete if only part could be read. Semantic header/navigation/footer links,
reserved Instagram paths and untrusted URLs are not relationship records.
Existing normalization and deleted-account handling remain unchanged.

Missing files stay **missing**. Successfully parsed lists, including convincing
explicit category-empty exports, are **available**. Present files that cannot be
safely interpreted stay **unsupported**. A generic empty document or display name
does not establish an empty list or account identity.

The synthetic regression fixture is
`tests/helpers/html-connection-export.ts`. It contains no personal export data.
This work does not add recent follow requests, removed suggestions or contacts,
change Vault/Review Memory formats, alter Circle Pulse, or modify public SEO.
