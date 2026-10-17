# Google Search: Übergabe für den Eigentümer (INS-154)

## Befund und Grenzen

Der Eigentümer meldet für den untersuchten Zeitraum keine Impressionen. Die
Ursache ist **nicht festgestellt**. Unterschiedliche Datumsangaben werden nicht
als Erklärung verwendet. Ein erfolgreicher HTTP-Abruf beweist weder Indexierung
noch Googles gewählte kanonische URL. Es besteht kein Zugriff auf aktuelle
URL-Prüfung, Crawling-Statistik, manuelle Maßnahmen oder Sicherheitsprobleme.

Vor der Änderung geprüft: `main` **8ecb31747d2bff976afb48e4ade5026eed99d9e6**,
Cloudflare-Build **df626ac5-78d2-4860-8c03-1163ce280168** erfolgreich,
[GitHub CI 39022294288](https://github.com/altayince/instascope/actions/runs/39022294288)
erfolgreich. Alle 31 bisherigen öffentlichen Instagram-Seiten liefern 200,
index/follow und passende Canonical-/OG-URLs; Sitemap und referenzierte JS/CSS
sind erreichbar. Die bisherige WhatsApp-Version ist absichtlich noindex. Der
INS-154-Code ist damit noch nicht auf Produktion bestätigt.

Die privat geprüfte Search-Console-Datei stützt die Themen öffentlicher
Profilzugriff, aufgezeichnete Follower-Daten, Exportanalyse und gesendete
Anfragen. Einzelne Abfragen sind kein vollständiger Suchdatensatz. Diagramm-,
Seiten- und Abfragesummen nicht addieren oder als identische Aggregation behandeln.
Der Analytics-Auszug beweist weder Google-Impressionen noch eindeutige Menschen:
`pre_audit`, `legacy`, `none`, `browserish` und `webdriver=no` sind keine
Suchindex-Belege. Rohabfragen und private Anhänge bleiben außerhalb des Repos.

## Nach Merge und bestätigtem Deployment

1. Den neuen Main-SHA, aktiven Cloudflare-Produktionsbuild und dessen Erfolg
   notieren. Nicht einen alten fehlgeschlagenen Preview-Build untersuchen.
2. `node scripts/audit-public-seo.mjs https://instascope.me` ausführen.
3. `node scripts/smoke-production.mjs https://instascope.me --require-profile --require-whatsapp --require-seo`
   ausführen. Der neue Sollzustand umfasst **46 öffentliche URLs**: 31 Instagram,
   vier WhatsApp-Tools, den WhatsApp-Guide-Hub und zehn Guides. Jede URL genau
   einmal, nur HTTPS/instascope.me. Dashboard und Instagram Snapshot Vault fehlen.
4. Öffentliche Seiten müssen 200/index/follow, selbstreferenzierende Canonicals
   und sichtbaren initialen Inhalt liefern. `robots.txt` erlaubt `/`, sperrt nur
   `/api/` und nennt `https://instascope.me/sitemap.xml`. Ein Preview bleibt
   noindex/nofollow mit `Disallow: /` und leerer Sitemap.
5. Synthetic-Browsertests nur mit vor Navigation abgefangenem `/api/events`.
   Keine künstlichen Produkt-Events an den produktiven Collector schicken.

## Search Console in deutscher Oberfläche

Die Property für **instascope.me** wählen. Keine Zugangsdaten oder Tokens teilen.
Die folgende Liste prüft reale Befunde; sie behauptet keine bereits erfolgte
Indexierung. Beschriftungen können bei Google geringfügig variieren.

- **Leistung → Suchergebnisse:** Suchtyp Web, betroffenen Zeitraum und Vergleich
  wählen; aktive Filter prüfen. Seiten und Suchanfragen getrennt ansehen. Die
  berichtete Nullphase mit der konkreten Property und Filterkombination belegen.
- **URL-Prüfung:** eine vollständige priorisierte URL oben eingeben.
  **Seitenindexierung** öffnen; Abruf, Crawling-Freigabe, Indexierbarkeit,
  letzten Crawl und **Von Google ausgewählte kanonische URL** festhalten. Dies
  ist Googles gespeicherter Stand, nicht automatisch die aktuelle Seite.
- **Live-URL testen:** gerenderten Inhalt und Ressourcen über **Getestete Seite
  anzeigen** prüfen. Dieser Test ersetzt weder den gespeicherten Indexstatus
  noch Googles kanonische Auswahl. Erst nach erfolgreichem Live-Test bei Bedarf
  **Indexierung beantragen**; keine wiederholten Massenanfragen.
- **Indexierung → Seiten:** konkrete Ausschlussgründe für betroffene URLs
  prüfen, insbesondere noindex, robots-Sperren, Abruffehler, alternative
  Canonical, gecrawlt/entdeckt aber nicht indexiert und Soft-404. Nur eine
  tatsächlich behobene Ursache mit **Fehlerbehebung überprüfen** bestätigen.
- **Sitemaps:** genau `https://instascope.me/sitemap.xml` einreichen bzw. den
  vorhandenen Eintrag prüfen; Status, letzten Abruf und erkannte URLs notieren.
  Keine Preview-, workers.dev-, Query- oder privaten URLs einreichen.
- **Einstellungen → Crawling-Statistik:** Host-Verfügbarkeit, Antwortcodes und
  konkrete fehlgeschlagene Abrufe prüfen. Ein selbst gesetzter Googlebot-Header
  bestätigt keinen echten Googlebot-Zugriff.
- **Sicherheit & manuelle Maßnahmen:** **Manuelle Maßnahmen** und
  **Sicherheitsprobleme** öffnen. **Entfernen** separat auf aktive Anträge
  prüfen; dieses Tool nicht zur Indexierungsanforderung verwenden.

Google-Anleitungen: [URL-Prüfung und Live-Test](https://support.google.com/webmasters/answer/9012289?hl=de),
[Seitenindexierung](https://support.google.com/webmasters/answer/7440203?hl=de-DE),
[Sitemaps](https://support.google.com/webmasters/answer/7451001?hl=de),
[Crawling-Statistik](https://support.google.com/webmasters/answer/9679690?hl=de),
[manuelle Maßnahmen](https://support.google.com/webmasters/answer/9044175?hl=de-DE),
[Sicherheitsprobleme](https://support.google.com/webmasters/answer/9044101?hl=de-DE),
[Entfernen](https://support.google.com/webmasters/answer/9689846?hl=de).

## Priorisierte URL-Prüfung

Jeweils `https://instascope.me` voranstellen. Bestehende Instagram-Ziele zuerst
prüfen, dann die neuen öffentlichen WhatsApp-Einstiege. Dies ist eine kleine
Arbeitsreihenfolge, keine automatische Submission und kein Ranking-Versprechen.

| Priorität | URL                                                   | Zweck                                                    |
| --------- | ----------------------------------------------------- | -------------------------------------------------------- |
| 1         | `/`                                                   | Produktions-/Canonical-Basis                             |
| 1         | `/how-to-see-when-someone-followed-you-on-instagram/` | Eingehende aufgezeichnete Follower-Daten                 |
| 1         | `/how-to-see-when-you-followed-someone-on-instagram/` | Bestehendes Ziel für die umgekehrte Following-Richtung   |
| 1         | `/followers-analyzer/`                                | Direkter Zugang zu importierten Follower-Listen          |
| 1         | `/how-to-view-instagram-profiles-without-an-account/` | Öffentlich zugängliche Profile, ehrliche Einschränkungen |
| 1         | `/instagram-sent-follow-requests/`                    | Gesendete Anfragen aus Exportdaten                       |
| 1         | `/how-to-download-instagram-followers-data/`          | Exportanleitung und Produktzugang                        |
| 1         | `/how-to-analyze-instagram-data-download/`            | Exportanalyse und unterstützte Daten                     |
| 2         | `/whatsapp/`                                          | Öffentlicher Produkteinstieg                             |
| 2         | `/whatsapp/chat-analyzer/`                            | Chat Analyzer                                            |
| 2         | `/whatsapp/wrapped/`                                  | Lokale Wrapped-Karten                                    |
| 2         | `/whatsapp/chat-vault/`                               | Öffentliche Hilfe für lokale Snapshots                   |
| 2         | `/whatsapp/guides/`                                   | Hub mit allen zehn Guides                                |
| 3         | `/whatsapp/guides/export-whatsapp-chat/`              | Voraussetzung: geeigneter Chat-Export                    |
| 3         | `/whatsapp/guides/analyze-group-chat/`                | Gruppenanalyse                                           |
| 3         | `/whatsapp/guides/compare-chat-exports/`              | Vergleich zweier eigener Exporte                         |

Die übrigen sieben Guides sind über Hub und Sitemap erreichbar. Weitere
Einzelanfragen nach Googles Quoten und realem Bedarf priorisieren; nicht alle
URLs ständig erneut beantragen. Unveränderte Instagram-URLs nicht umbenennen.

Nach bestätigtem Deployment dessen Zeitpunkt als Release-Basis notieren. Nach
sieben und nach 28 Tagen dieselben GSC-Einstellungen erneut vergleichen:
Suchtyp Web, identische Property und definierte Vergleichszeiträume. Impressionen,
Klicks, CTR und durchschnittliche Position getrennt für bestehende Instagram-
URLs und neue `/whatsapp/`-URLs prüfen. Eine einzelne URL kann zusätzlich nach
ihrem dokumentierten Suchintent betrachtet werden. Änderungen beschreiben,
nicht automatisch dem Release zuschreiben; geringe Datenmengen erlauben keine
verlässliche Kausalitätsaussage. Diese zwei Kontrollpunkte sind manuelle
Messschritte, kein eingerichtetes Monitoring und keine automatische Submission.

## Hosting-Hygiene: separate Eigentümerentscheidung

Der aktuelle Audit findet `www.instascope.me` nicht im DNS (NXDOMAIN). Wenn der
Alias gewünscht ist, im eigenen Cloudflare-Konto DNS/TLS für `www` bereitstellen
und anschließend permanent auf `https://instascope.me` weiterleiten; Pfad und
Query erhalten, Schleifen vermeiden. Die bestehende HTTPS-Weiterleitung des
Apex nicht entfernen. Fehlendes `www` ist hier keine bewiesene Ursache des
Impressionsrückgangs.

`https://instascope.altayince34.workers.dev/` und dessen Followers-Seite liefern
derzeit index/follow bei korrektem Produktions-Canonical. Optional im Account:
**Workers & Pages → instascope → Settings → Domains & Routes → workers.dev →
Disable**, nachdem die offizielle Custom Domain bestätigt wurde. Cloudflare
dokumentiert, dass das separate Abschalten dieser Produktionsadresse Preview-,
Version- und Deployment-URLs nicht abschaltet. Einen späteren autorisierten
Wrangler-Abgleich (`workers_dev: false`) einplanen, sonst kann ein Redeploy die
Adresse reaktivieren. Vor und nach einer Änderung konkrete Preview-URLs und
Custom Domain prüfen; Preview-Konfiguration dieses PRs bleibt unverändert.
Eine Redirect-Regel in der eigenen Zone `instascope.me` kontrolliert den fremden
Hostname `workers.dev` nicht. Alternativ beschreibt Cloudflare Access getrennten
Schutz für Produktions- und Preview-Adressen. Keine dieser Account-Änderungen
wurde in INS-154 ausgeführt. [Cloudflare workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)

## Rollback und Abschluss

Vor Merge den aktuellen aktiven Deployment-Identifier erneut festhalten. Der
oben genannte Build ist eine geprüfte Basis, keine Garantie, dass er beim späteren
Merge noch der Vorgänger ist. Bei echten Produktionsregressionen entscheidet der
Eigentümer über das Wiederherstellen dieses bekannten guten statischen
Deployments und einen separaten Revert-PR. Keine Force-Pushes und kein beiläufiges
Rollback von Analytics-/Profile-Workern, Bindings oder Browserdaten. Ein Rollback
vor INS-154 stellt auch die bisherige WhatsApp-noindex-Politik wieder her; der
neue vollständige SEO-Gate muss dann erwartbar fehlschlagen.

Reine Google-Verzögerungen oder ausbleibende Impressionen sind für sich kein
Nachweis eines Produktionsfehlers. Nach einer notwendigen Wiederherstellung
Instagram, WhatsApp-Tools, Canonicals, robots, Sitemap und Worker-Health erneut
prüfen und den tatsächlichen Policy-Stand dokumentieren.

| Status                       | Erforderlicher Beleg                                                             |
| ---------------------------- | -------------------------------------------------------------------------------- |
| IMPLEMENTATION READY         | Aktueller PR: Checks, beide Builds, Audits und Browser-/Visualtests bestanden    |
| PRODUCTION VERIFIED          | Bestätigter neuer aktiver Build und danach vollständiger Live-Audit bestanden    |
| GOOGLE INDEX STATUS VERIFIED | Aktuelle URL-Prüfung/Seitenindexierung, inklusive Google-Canonical               |
| TRAFFIC RECOVERY OBSERVED    | Spätere GSC-Leistungsdaten zeigen die reale Entwicklung im definierten Vergleich |

Keinen späteren Status aus einem früheren ableiten. Der technische Launch kann
bereit sein, während Google-Status und Traffic weiterhin unbestätigt bleiben.
