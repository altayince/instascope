# Private aggregate product analytics

InstaScope records a small allowlist of semantic product events through its own
same-origin endpoint. These counts help answer whether exports are being imported,
whether parsing finishes, and whether people reach useful product actions. They do
not identify people or connect their actions into sessions.

No Google Analytics, Meta Pixel, session replay, advertising tracker, analytics
cookie, fingerprint, session ID or persistent anonymous ID is used. Analytics
failure never blocks importing, analysis, local storage, downloading or navigation.

INS-110 was merged in PR #111 (`840df99`), and the owner confirms production
analytics is deployed. The 13 October 2026 non-writing audit found live Privacy
configured for `/api/events`, GET returning 405 (`Allow: POST`) and an unknown
`readiness_probe` POST returning 400 with `no-store` and `noindex`. This verifies
routing/bindings without writing a metric; it does not establish durable delivery
or event totals. [Current product status](roadmap-progress.md).

INS-134 proposes the bounded traffic attribution contract below. It is not yet
deployed: current production still uses the earlier event-only schema. The owner
must deploy the backward-compatible Worker first, verify legacy delivery, and
only then merge/build/publish the enriched client. This task does not deploy the
Worker, merge the PR or publish the static site.

## Data contract and privacy

The enriched client sends exactly three bounded fields:

```json
{ "event": "parser_succeeded", "source": "google", "webdriver": "no" }
```

`track()` still accepts only the typed event name, without a metadata argument.
Its runtime allowlist also rejects unknown values. It obtains source and webdriver
hints itself. The request uses `POST`, JSON, `credentials: "omit"`,
`referrerPolicy: "no-referrer"`, `keepalive: true`, `redirect: "error"`, and a
relative same-origin endpoint. The HTTP `Referer` header does not expose the page
referrer. The constant destination `/api/events` is infrastructure, not a recorded
page-view URL. Failures are best effort and never block a product action.

The exact `TrafficSource` enum is `google | bing | search_other | external |
same_site | none | unknown`:

| Source | Meaning |
| ------ | ------- |
| `google` | A Google-family hostname was visible in the document referrer, including regional and subdomain forms; not proof of Google Web Search or a Google Search Console click |
| `bing` | A Bing-family hostname was visible |
| `search_other` | A fixed hostname allowlist recognizes DuckDuckGo, Yahoo Search, Yandex, Ecosia, Brave Search, Startpage or Qwant |
| `external` | A valid external referrer was visible but its host was not a recognized search host |
| `same_site` | The document was referred by `instascope.me` |
| `none` | No referrer was visible; browsers, apps and privacy settings may suppress it, so this is not proof of direct traffic |
| `unknown` | An unexpected or unparseable referrer condition |

Classification happens locally using the referrer's hostname only. No path,
query, fragment or search query is inspected for attribution. The source is
computed once per browser `Document`, held only in memory and retained across SPA
navigation. A full document load gets a new classification. No analytics context
or guard is stored in localStorage, sessionStorage, IndexedDB or cookies.

The client webdriver hint is exactly `yes | no | unknown`, derived only from
`navigator.webdriver`. `yes` is strong automation evidence; `no` does not prove a
human. The Worker transiently reduces the HTTP User-Agent to
`automation | browserish | unknown`. Obvious crawler, bot, headless-browser and
command-line HTTP client tokens produce `automation`; a recognizable browser
shape without those tokens produces `browserish`; missing or unrecognized values
produce `unknown`. It does not classify browser brand, version, device or OS.
`browserish` does not prove a human. These coarse hints are spoofable and cannot
establish authenticity.

The analytics payload and stored rows never contain raw referrers, referring hostnames or URLs,
page URLs or paths, query strings, fragments, search queries, raw User-Agent
strings, IP addresses, usernames, relationship counts, filenames, archive data,
notes, Review Memory flags, Watch targets, snapshot dates, relationship states or
profile-search usernames. It creates no session ID, cookie, persistent anonymous
ID or fingerprint. It does not collect browser version, screen size, hardware,
timezone, language, canvas, WebGL or fonts. Normal HTTP headers and connection
information still reach the hosting infrastructure, as described below; raw
request metadata is not copied into Analytics Engine.

The Worker supplies exactly:

```ts
EVENTS.writeDataPoint({
  blobs: [event, source, webdriver, uaHint],
  doubles: [1],
});
```

| Field | Stored value |
| ----- | ------------ |
| `blob1` | Allowlisted semantic event |
| `blob2` | Traffic source bucket; `legacy` for an accepted old envelope |
| `blob3` | Webdriver hint; `legacy` for an accepted old envelope |
| `blob4` | Transiently derived UA automation hint |
| `double1` | Constant increment `1` |

No indexes, additional blobs or additional doubles are supplied. `double1` is
not a follower count or another user-data value. Old browser tabs may still send
exactly `{ "event": "profile_search" }`; the updated Worker accepts this legacy
envelope and writes `[event, "legacy", "legacy", uaHint]` with `double1 = 1`.
Existing historical rows remain untouched and have empty new blob fields. SQL
below labels those missing dimensions `pre_audit`, separately from `legacy` and
the new `unknown` bucket. Cloudflare also creates platform fields including dataset
name, ingestion `timestamp` and `_sample_interval`. The timestamp describes
analytics ingestion, never an Instagram action or export date. Cloudflare's
currently documented Analytics Engine retention is three months. See the
[SQL table fields](https://developers.cloudflare.com/analytics/analytics-engine/sql-api/)
and [retention limits](https://developers.cloudflare.com/analytics/analytics-engine/limits/).

`CF-Connecting-IP` is passed to the native abuse limiter only. It is never copied
into Analytics Engine data, returned to the browser, or intentionally logged by
this Worker. Request bodies, cookies and user agents are not logged. The Worker
has observability, invocation logs and Logpush disabled in its committed config.
Normal Cloudflare/hosting request processing is separate: the provider necessarily
receives connection information. Review account-level request logging and access
settings separately rather than claiming that the hosting provider never sees an
IP address.

Do Not Track (`navigator.doNotTrack === "1"` or legacy `"yes"`) prevents remote
client delivery.
The Worker also discards a request carrying `DNT: 1` without writing an event.
Local `instascope:event` diagnostics carry only the event name and do not persist
anything. They do not contact a server when the endpoint is disabled.

No analytics data is written to localStorage, IndexedDB, cookies, Vault backups or
Review Memory. Any guards against duplicate rendering are held in memory; they
are not transmitted identifiers. Existing product storage schemas and parsing
rules are independent of analytics.

## Exact event allowlist and trigger audit

The shared client/Worker allowlist contains these **27 events**. The existing 26
event meanings remain unchanged. Opening a surface
describes access to a view, not proof that the person completed its task or that
an optional export category was available.

The table records the previous trigger, its intended trigger after this audit,
repeat behavior, and the meaning of the count. “Per opening” permits a deliberate
departure and return; it excludes ordinary rerenders and effect replay. Intentional
actions may repeat. There is no global deduplication of separate imports, downloads
or searches.

| Event                       | Previous trigger                                             | Audited trigger                                                                                  | Can repeat?                                      | Meaning                                                                      |
| --------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------ | ---------------------------------------------------------------------------- |
| `document_entry_observed`   | Not recorded                                                 | Client JavaScript executes for a browser document                                                 | At most once per full browser document          | Browser document observation; not a unique visitor, user, session, pageview identity or GSC click |
| `dashboard_opened`          | Dashboard mount effect, without a replay guard               | Dashboard opening                                                                                | Per opening                                      | Dashboard access, including empty/demo views; not a distinct visitor         |
| `landing_viewed`            | Workspace mount/mode effect on unrelated tool routes         | Homepage Workspace entry without an active dataset                                               | Per opening                                      | Empty homepage client access; not every SEO route or active workspace        |
| `parser_started`            | Upload handler before `readExport`                           | Each intentional real export parser run                                                          | Per import attempt                               | A real file import was attempted, including an older comparison export       |
| `parser_succeeded`          | Successful upload handler                                    | Real parser run returned a normalized dataset                                                    | Per successful run                               | Supported real export parsing completed; not demo activation                 |
| `parser_failed`             | Upload error handler                                         | Real parser run failed                                                                           | Per failed run                                   | An attempted real file import could not finish                               |
| `results_viewed`            | Emitted immediately in Upload after parsing                  | Real active import results rendered                                                              | Once for an active imported dataset              | Results reached the product UI; not another older-file parser success        |
| `cleaner_opened`            | Workspace mode effect, even before results                   | Cleaner Workspace entry with a dataset                                                           | Per opening                                      | Cleaner access; no selected accounts or review outcomes                      |
| `wrapped_generated`         | Workspace analysis/mode effect, including demo/remounts      | Real Wrapped output becomes available                                                            | Once for an active real dataset                  | A real export produced Wrapped; not a count of individual cards              |
| `wrapped_downloaded`        | PNG download branch, including demo                          | Real Wrapped PNG download, including share fallback                                              | Per successful download action                   | A download was initiated; no image contents or dimensions                    |
| `wrapped_shared`            | Resolved Web Share call, including demo                      | Real Wrapped Web Share promise resolves                                                          | Per successful share action                      | Handed to the device share flow, not proof of a published Story              |
| `comparison_started`        | Only the manual older-upload callback                        | Real manual pair accepted; saved comparison attempted; validated Vault comparison starts reading | Per comparison attempt                           | A real comparison was attempted; no dates, selections or relationships       |
| `comparison_succeeded`      | Workspace derived comparison effect, including demo/remounts | Real comparison produces a usable result                                                         | Per completed comparison operation               | A real comparison completed, including saved-history paths                   |
| `profile_search`            | Valid profile form submission                                | Valid public-photo lookup attempt                                                                | Per attempt                                      | Public-photo utility demand; never the searched username                     |
| `profile_succeeded`         | Verified remote image `onLoad`, guarded by image URL         | Verified remote photo loads for an attempt                                                       | Once per successful attempt                      | A usable public photo was shown; not image quality or original resolution    |
| `profile_failed`            | API, validation, network/image error and timeout paths       | Terminal failure of a valid lookup attempt                                                       | Once per failed attempt                          | Lookup unavailable, blocked, limited or failed; no reason metadata           |
| `snapshot_saved`            | Not recorded                                                 | Real storage save commits, before UI refresh                                                     | Per successful new save or confirmed replacement | A snapshot was persisted locally; rejected duplicates/failures do not count  |
| `snapshot_vault_opened`     | Not recorded                                                 | Snapshot Vault opening                                                                           | Per opening                                      | Vault access, including empty/demo views; not proof of a return visit        |
| `watch_circle_opened`       | Not recorded                                                 | Embedded Watch Circle first intersects the viewport                                              | Once per surface mount                           | Surface reached; no watch targets or visibility coordinates                  |
| `review_memory_used`        | Not recorded                                                 | Successful real manual `store.update`                                                            | Per committed write                              | Local review write; not hydration, import or deletion; no values             |
| `circle_pulse_opened`       | Not recorded                                                 | Embedded Circle Pulse first intersects the viewport                                              | Once per surface mount                           | Saved-history surface reached; no totals, states or coordinates              |
| `export_doctor_opened`      | Not recorded                                                 | Active parent Export Doctor disclosure opens                                                     | Once per component mount                         | Report accessed; excludes nested partial-demo disclosure; no quality details |
| `demo_started`              | No explicit event; some demo effects inflated other metrics  | Shared demo-start action or Vault demo toggle                                                    | Per intentional activation                       | Demo discovery; no exit, route remount or demo query deep-link count         |
| `pending_requests_opened`   | Not recorded                                                 | Requests Workspace entry with a dataset                                                          | Per opening                                      | Requests-tool access, not a request count or live pending-state claim        |
| `connection_privacy_opened` | Not recorded                                                 | Connection Privacy Workspace entry with a dataset                                                | Per opening                                      | Privacy-list tool access; no memberships or category counts                  |
| `timeline_opened`           | Not recorded                                                 | Relationship Timeline Workspace entry with a dataset                                             | Per opening                                      | Timeline access; no direction, username, dates or graph values               |
| `unfollow_history_opened`   | Not recorded                                                 | Unfollow History Workspace entry with a dataset                                                  | Per opening                                      | History-tool access; no action details or removed-suggestion records         |

The earlier INS-110 trigger audit removed broad Workspace `landing_viewed` emissions, immediate
Upload-level `results_viewed` emissions, demo-only real outcome events, and
rerender/remount duplication of the same completed import/derived result. Manual,
saved-current and Vault comparisons use the same real comparison event meaning.
Profile outcomes must settle once per valid lookup rather than once for every
image callback or timeout.

An import result and Wrapped generation are guarded by the active dataset's
in-memory object identity across route remounts. Each new real import remains a
new parser run and result. Opening counts use local component guards, not browser
storage or session identifiers. For embedded Watch Circle and Circle Pulse,
`IntersectionObserver` controls the first visible opening; its geometry never
leaves the browser. If that API is unavailable, those visibility events are
omitted. Doctor can be reopened without another event during the same mount.
Review Memory counts manual successful writes only; loading, deleting and
restoring a backup do not inflate `review_memory_used`.

The global document initializer covers the homepage, SEO pages and tools. Its
`document_entry_observed` guard lives in document memory: React remounts,
StrictMode replay and SPA navigation do not emit another entry. A full reload or
new document may emit again. DNT suppresses its remote delivery like every other
event, and preview/local isolation is unchanged. It counts documents where client
JavaScript executed and delivery succeeded, never unique visitors or Search
Console clicks. It adds no arbitrary route/page-view events.

Events deliberately not added: arbitrary route/page-view events, button clicks,
search terms, account opens, private-list category counts, Review Memory flag
variants, snapshot dates/IDs, parser file types, errors as metadata, country/device
breakdowns, session starts or return-user identifiers. Archive Extras, Watch
Circle and Review Memory do not send their contents.

## Demo versus real activity

Explicit fictional demo activation emits `demo_started`. Opening general product
surfaces may emit their opening events while displaying demo data; those counts
measure discoverability, not real-data usage. Demo never simulates a real file
parser run or emits real `results_viewed`, comparison outcomes, snapshot saves,
Review Memory persistence, Wrapped generation/download/share outcomes or remote
profile lookup outcomes. The Profile Viewer local sample remains separate from
real public-photo lookup.

There is no metadata field saying “demo.” This separation is implemented at the
semantic trigger. Reports must therefore not infer real export use from a surface
opening alone.

## Aggregate funnels and interpretation

These are **event-volume ratios**, not session-linked funnels or user conversion
rates:

| Question             | Event sequence / ratio                                                           |
| -------------------- | -------------------------------------------------------------------------------- |
| Import activity      | `landing_viewed` → `parser_started` → `parser_succeeded` → `results_viewed`      |
| Parse success        | `parser_succeeded / parser_started`                                              |
| Result completion    | `results_viewed / parser_succeeded`                                              |
| Saved-history use    | `snapshot_saved` → later aggregate `comparison_started` → `comparison_succeeded` |
| Wrapped use          | `wrapped_generated` → `wrapped_downloaded` / `wrapped_shared`                    |
| Wrapped download     | `wrapped_downloaded / wrapped_generated`                                         |
| Public-photo utility | `profile_search` → `profile_succeeded` / `profile_failed`                        |
| Public-photo success | `profile_succeeded / profile_search`                                             |

Do not report “63% of users converted” or “users returned after saving.” Without a
user/session identifier, a saved snapshot and a later comparison cannot be linked
to the same person, browser or account. A Vault opening may happen immediately,
in an empty Vault or in demo; it is not a retention measurement.

Use the same time window for each numerator and denominator. Direct tool entry
may have no `landing_viewed`. Older real comparison-file uploads also count as
parser runs. One generated Wrapped can produce several downloaded cards. A
person may perform several imports or comparisons. Actions may straddle the
window boundaries. DNT, blockers, rate limiting, network failure, browser closing
and best-effort delivery lose events. Ratios can exceed 1 and do not establish
ordered completion by the same person. Client events reduce server-crawler noise
but do not prove that every accepted event came from a human.

## Worker boundary

`workers/analytics.ts` handles the exact `/api/events` path with no query string.
It requires a same-origin `Origin` and accepts only `POST` with an
`application/json` media type. Browser Fetch Metadata, when present, must describe
a same-origin fetch rather than a navigation or cross-site request. These checks
are inexpensive noise/abuse controls, not browser fingerprinting or authentication.
Headers absent from older clients are not replaced with user-agent heuristics;
the coarse UA hint is a separate stored dimension, not a bypass for these checks.

The request remains capped at **100 bytes**, including streaming UTF-8 bytes;
oversized bodies are cancelled. The longest compact enriched envelope is 83
bytes (96 with standard two-space JSON formatting), so no increase is needed.
The Worker accepts only the exact legacy `event` envelope or the exact enriched
`event`, `source`, `webdriver` envelope, with allowlisted event names and exact
bounded enum values. Partial envelopes, duplicate keys, extra metadata, arrays,
nested objects, malformed JSON, invalid UTF-8 and arbitrary strings are rejected.
Raw URL/referrer/UA metadata cannot be injected. No raw validation input is
returned or logged. Missing or failing bindings fail closed for analytics.

| Status | Meaning                                                                         |
| ------ | ------------------------------------------------------------------------------- |
| `204`  | Event accepted for the platform write, or DNT request discarded without a write |
| `400`  | Malformed/unknown payload or invalid endpoint path/query                        |
| `403`  | Cross-origin request or incompatible Fetch Metadata                             |
| `405`  | Unsupported method; `Allow: POST`                                               |
| `413`  | Body exceeds the byte limit                                                     |
| `415`  | Wrong content type                                                              |
| `429`  | Native abuse limiter refused the request                                        |
| `503`  | Analytics binding/limiter unavailable or write failed                           |

All responses use `Cache-Control: no-store`, `X-Robots-Tag: noindex` and
`X-Content-Type-Options: nosniff`. No CORS permission is added. The client never
waits for analytics success before continuing the product action and does not
retry failed events automatically.

The production limiter is `60` calls per `60` seconds per IP key per Cloudflare
location. Shared IPs can share that allowance. Native counters are eventually
consistent and are not exact global quotas or an analytics accounting source.
Namespace `1002` must be distinct from unrelated account limiters. See
[Cloudflare native rate limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

## Production deployment and preview isolation

The existing event-only collector is deployed. The INS-134 Worker/client changes
are proposed and remain undeployed until the owner follows the Worker-first
rollout below. These are owner instructions, not actions performed by this task.

`workers/wrangler.analytics.jsonc` declares the production dataset, limiter and
HTTPS route:

```text
Browser POST https://instascope.me/api/events
  → instascope-product-events Worker
  → EVENTS: instascope_events
  → blob1: event, blob2: source, blob3: webdriver, blob4: UA hint, double1: 1
```

The route is `https://instascope.me/api/events*` for the `instascope.me` zone.
The Worker rejects suffix paths and query strings. `workers_dev` and Worker
preview URLs are disabled. The default environment is separately named
`instascope-product-events-local` and has no production route or storage binding,
so accidentally omitting `--env production` does not replace the production
collector. Use the explicit `production` environment. Bindings are not
assumed to inherit from another environment.

1. Authenticate to the Cloudflare account owning the zone. Keep credentials
   outside the repository. An automated deploy needs appropriately account/zone
   scoped Workers Scripts edit, Workers Routes edit and zone-read access. Select
   the intended account with `CLOUDFLARE_ACCOUNT_ID` when necessary.
2. Confirm proxied DNS for `instascope.me`, Analytics Engine availability, current
   quotas and pricing. This repository does not buy a plan or configure account
   permissions. The existing application can stay on its current static host.
3. Confirm namespace `1002` is not used by an unrelated account limiter. Its
   production `RATE_LIMITER` is native, not a KV database. Native rate limiter
   bindings are not currently visible in the dashboard; use the deployed config
   and Wrangler output rather than relying on the Bindings screen alone.
4. Review the PR and require passing CI. From the reviewed INS-134 branch, the
   owner may dry-run and then deploy the backward-compatible Worker **before
   merging or publishing the enriched client**:

   ```text
   npx --yes wrangler@4.147.0 deploy --config workers/wrangler.analytics.jsonc --env production --dry-run
   npx --yes wrangler@4.147.0 deploy --config workers/wrangler.analytics.jsonc --env production
   ```

5. Confirm Workers & Pages → `instascope-product-events` → Settings → Domains &
   Routes has the production route. Analytics Engine dataset creation is automatic
   on the first accepted event; no manual dataset creation is required.
6. Before merging/publishing the client, verify the existing legacy endpoint
   remains healthy. Use the non-writing unknown-event probe in
   [deployment.md](deployment.md): expect `400`, `no-store` and `noindex`; GET
   remains `405` with `Allow: POST`. This establishes routing/binding checks only.
   Privately inspect ingestion from a genuine product action made by the still
   deployed legacy client; the updated Worker should store `legacy` for source
   and webdriver plus a derived UA hint. Do not inject a fabricated allowlisted
   test event into production totals. Existing tabs must remain compatible.
7. Only after that verification may the owner merge the reviewed PR into `main`,
   build and publish the client with
   `NEXT_PUBLIC_ANALYTICS_ENDPOINT=/api/events`. This is
   a **static site build variable**, not a Worker runtime setting. Recognized
   production builds default to this value; explicit configuration wins. Next
   freezes public environment settings into the bundle, so dashboard changes
   require a rebuild. Verify the generated and live Privacy explanation.
8. After real traffic arrives, use the last-24-hour queries below. Verify enriched
   dimensions and keep `pre_audit`, `legacy` and new attributed rows distinct.
   Readiness and successful ingestion do not prove human authenticity. Keep old
   envelope support for tabs that were opened before the client rollout.

The client speaks directly to the same-origin route. The app Worker must not call
a same-zone route through server-side `fetch()`; a future server integration would
need a service binding. No `workers.dev` analytics URL or CORS widening is needed.
Deploying the static app or committing a config does not deploy this separate
Worker. Configure a separate CI project only if explicitly managing that
deployment. See [Cloudflare routes](https://developers.cloudflare.com/workers/configuration/routing/routes/),
[Analytics Engine setup](https://developers.cloudflare.com/analytics/analytics-engine/get-started/)
and [Next build-time environment variables](https://nextjs.org/docs/app/guides/environment-variables).

Preview, staging and unconfigured local builds default to no remote endpoint,
including preview branches that inherit the production origin. An explicit valid
relative endpoint can be used for a local/mock test, but it must not share the
production dataset/route unintentionally. There are no automatic server page-view
events and no scheduled analytics collection.

## Inspecting aggregate counts privately

Use the account-level **Workers Analytics Engine SQL API**, not a public product
endpoint:

```text
POST https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/analytics_engine/sql
Authorization: Bearer <ACCOUNT_ANALYTICS_READ_TOKEN>
Body: raw SQL text
```

Create an account-restricted token with **Account Analytics Read**, keep it outside
the repository, and use it only from a private terminal/dashboard. Never compile
it into `NEXT_PUBLIC_*` variables. `SHOW TABLES` discovers the dataset after its
first write. The product has no reporting endpoint or analytics dashboard.

### Traffic attribution audit: last 24 hours

Each query is ready to run against the existing `instascope_events` dataset via
the [Cloudflare SQL API](https://developers.cloudflare.com/analytics/analytics-engine/sql-api/).
They use supported aliases and the documented
[`if` conditional function](https://developers.cloudflare.com/analytics/analytics-engine/sql-reference/conditional-functions/).
Totals are sampling-weighted event volumes:
`SUM(_sample_interval * double1)`, not raw row counts, users or sessions. Sampling
can make these estimates rather than exact counts.

Empty dimensions on historical rows are displayed as `pre_audit`; `legacy`
means an old event-only client reached the updated Worker. New `unknown` values
mean classification was unavailable, not that the row predates the audit. No
backfill or attribution of historical rows is possible. The filters in C and D
exclude rows without the relevant evidence; B and E retain pre-audit rows as
separate groups. A has no historical entry counts because that event is new.

**A) Observed browser document entries by source and automation hints**

```sql
SELECT
  if(blob2 = '', 'pre_audit', blob2) AS source,
  if(blob3 = '', 'pre_audit', blob3) AS webdriver,
  if(blob4 = '', 'pre_audit', blob4) AS ua_hint,
  SUM(_sample_interval * double1) AS total
FROM instascope_events
WHERE timestamp >= NOW() - INTERVAL '24' HOUR
  AND blob1 = 'document_entry_observed'
GROUP BY source, webdriver, ua_hint
ORDER BY total DESC
FORMAT JSON
```

This observes delivered document-entry events where client JavaScript executed.
It is not a unique-visitor count, session count or Search Console click count.

**B) Attribution for the requested semantic events**

```sql
SELECT
  blob1 AS event,
  if(blob2 = '', 'pre_audit', blob2) AS source,
  if(blob3 = '', 'pre_audit', blob3) AS webdriver,
  if(blob4 = '', 'pre_audit', blob4) AS ua_hint,
  SUM(_sample_interval * double1) AS total
FROM instascope_events
WHERE timestamp >= NOW() - INTERVAL '24' HOUR
  AND blob1 IN (
    'profile_search', 'profile_succeeded', 'profile_failed',
    'parser_started', 'parser_succeeded', 'parser_failed', 'results_viewed'
  )
GROUP BY event, source, webdriver, ua_hint
ORDER BY total DESC
FORMAT JSON
```

**C) Google-family attributed semantic events**

```sql
SELECT
  blob1 AS event,
  blob2 AS source,
  if(blob3 = '', 'pre_audit', blob3) AS webdriver,
  if(blob4 = '', 'pre_audit', blob4) AS ua_hint,
  SUM(_sample_interval * double1) AS total
FROM instascope_events
WHERE timestamp >= NOW() - INTERVAL '24' HOUR
  AND blob2 = 'google'
  AND blob1 IN (
    'profile_search', 'profile_succeeded', 'profile_failed',
    'parser_started', 'parser_succeeded', 'parser_failed', 'results_viewed'
  )
GROUP BY event, source, webdriver, ua_hint
ORDER BY total DESC
FORMAT JSON
```

`google` means a Google-family referrer was visible. It does not establish a
Google Web Search click or reconcile one-to-one with Google Search Console.

**D) Events with automation evidence**

```sql
SELECT
  blob1 AS event,
  if(blob2 = '', 'pre_audit', blob2) AS source,
  if(blob3 = '', 'pre_audit', blob3) AS webdriver,
  if(blob4 = '', 'pre_audit', blob4) AS ua_hint,
  SUM(_sample_interval * double1) AS total
FROM instascope_events
WHERE timestamp >= NOW() - INTERVAL '24' HOUR
  AND (blob3 = 'yes' OR blob4 = 'automation')
GROUP BY event, source, webdriver, ua_hint
ORDER BY total DESC
FORMAT JSON
```

Legacy envelopes can appear here when the updated Worker's UA hint is
`automation`. Other rows, including `webdriver = 'no'` and `ua_hint = 'browserish'`,
are not thereby proven human. These signals are coarse and spoofable.

**E) Event-by-source matrix for all product events**

```sql
SELECT
  blob1 AS event,
  if(blob2 = '', 'pre_audit', blob2) AS source,
  SUM(_sample_interval * double1) AS total
FROM instascope_events
WHERE timestamp >= NOW() - INTERVAL '24' HOUR
GROUP BY event, source
ORDER BY event, total DESC
FORMAT JSON
```

`none` always means no visible referrer; it does not establish direct traffic.
This matrix includes all 27 allowlisted events, with distinct `pre_audit` and
`legacy` groups when observed. An absent group means no observed delivered rows
in that window, not proof of no activity.

### Requested operational totals

```sql
SELECT
  blob1 AS event,
  SUM(_sample_interval * double1) AS total
FROM instascope_events
WHERE timestamp >= NOW() - INTERVAL '7' DAY
  AND blob1 IN (
    'parser_started',
    'parser_succeeded',
    'parser_failed',
    'results_viewed',
    'snapshot_saved',
    'comparison_succeeded',
    'wrapped_generated',
    'wrapped_downloaded',
    'wrapped_shared',
    'profile_search',
    'profile_succeeded',
    'profile_failed'
  )
GROUP BY blob1
ORDER BY total DESC
FORMAT JSON
```

Remove the `AND blob1 IN (...)` filter to inspect the full 27-event allowlist.
An absent event has no row; interpret it as no observed events in that window,
not proof of no product activity. Sampling occurs at high volumes/read ranges:
`SUM(_sample_interval * double1)` accounts for it, unlike `COUNT()` or plain
`SUM(double1)`. Weighted totals can be estimates, not guaranteed exact counts.

### Ratios with a zero-denominator guard

Each query returns no row when its denominator is zero. Display “not available,”
not “0% converted.” No `WITH`, joins or session identifiers are needed.

```sql
SELECT succeeded / started AS parse_success_event_volume_ratio
FROM (
  SELECT
    SUM(if(blob1 = 'parser_succeeded', _sample_interval * double1, 0)) AS succeeded,
    SUM(if(blob1 = 'parser_started', _sample_interval * double1, 0)) AS started
  FROM instascope_events
  WHERE timestamp >= NOW() - INTERVAL '7' DAY
)
WHERE started > 0
FORMAT JSON
```

```sql
SELECT viewed / parsed AS result_completion_event_volume_ratio
FROM (
  SELECT
    SUM(if(blob1 = 'results_viewed', _sample_interval * double1, 0)) AS viewed,
    SUM(if(blob1 = 'parser_succeeded', _sample_interval * double1, 0)) AS parsed
  FROM instascope_events
  WHERE timestamp >= NOW() - INTERVAL '7' DAY
)
WHERE parsed > 0
FORMAT JSON
```

```sql
SELECT downloaded / generated AS wrapped_download_event_volume_ratio
FROM (
  SELECT
    SUM(if(blob1 = 'wrapped_downloaded', _sample_interval * double1, 0)) AS downloaded,
    SUM(if(blob1 = 'wrapped_generated', _sample_interval * double1, 0)) AS generated
  FROM instascope_events
  WHERE timestamp >= NOW() - INTERVAL '7' DAY
)
WHERE generated > 0
FORMAT JSON
```

```sql
SELECT succeeded / searched AS profile_success_event_volume_ratio
FROM (
  SELECT
    SUM(if(blob1 = 'profile_succeeded', _sample_interval * double1, 0)) AS succeeded,
    SUM(if(blob1 = 'profile_search', _sample_interval * double1, 0)) AS searched
  FROM instascope_events
  WHERE timestamp >= NOW() - INTERVAL '7' DAY
)
WHERE searched > 0
FORMAT JSON
```

These queries use the documented [SQL API sampling rules](https://developers.cloudflare.com/analytics/analytics-engine/sql-api/),
[subqueries](https://developers.cloudflare.com/analytics/analytics-engine/sql-reference/statements/)
and [`if` function](https://developers.cloudflare.com/analytics/analytics-engine/sql-reference/conditional-functions/).
Do not translate the returned ratios into unique-user claims.

## Disabling remote analytics

Set `NEXT_PUBLIC_ANALYTICS_ENDPOINT=off` in the site build environment, rebuild,
and publish that disabled build. `off` is not a relative endpoint and is resolved
to no endpoint; it is a portable intentional opt-out. An **explicit empty string**
also disables delivery when the build environment preserves it. Merely unsetting
the variable on a recognized production build restores the `/api/events` default.
External URLs and other invalid values are rejected rather than contacted.

For a POSIX shell:

```sh
NEXT_PUBLIC_ANALYTICS_ENDPOINT=off npm run build:production
```

For Windows PowerShell:

```powershell
$env:NEXT_PUBLIC_ANALYTICS_ENDPOINT = "off"
npm.cmd run build:production
```

Some PowerShell versions remove a variable when assigning `$env:NAME = ""`.
Use `off` rather than relying on an empty assignment. Verify the generated Privacy
text says remote analytics is not enabled before publishing. To restore the
production default later, remove the opt-out and rebuild; to enable it explicitly,
set `/api/events` and rebuild.

Remove the Cloudflare analytics route or undeploy the separate analytics Worker
as the server-side stop. Existing aggregate history follows the provider's
retention policy; disabling future delivery does not erase prior data. DNT is a
visitor-level remote opt-out regardless of the deployment default. Local
event-name diagnostics remain in page memory only and create no remote report.

INS-112's CSV/calendar utilities add no analytics events or fields. Its live
readiness audit changes no deployment, plan, account settings or bindings.
