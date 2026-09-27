# Production Roadmap V2 progress

Production: https://instascope.me. The supplied [V2 roadmap](PRODUCTION_ROADMAP_V2.md) supersedes the ordering of the earlier next-phase brief. Preserve the existing product; each milestone gets its own validated commit and follows the INS issue/branch/PR flow. No direct pushes to main and no pushes with failing validation.

- [x] M0 — Baseline validation (INS-9)
- [x] M1 — Production domain, navigation and arrow cleanup (INS-12; validated build, live deployment pending)
- [x] M2 — Search engine readiness (INS-13; production and preview artifacts verified, live audit pending)
- [ ] M3 — High-intent landing pages
- [ ] M4 — Fictional demo mode
- [ ] M5 — Homepage acquisition and conversion
- [ ] M6 — Useful SEO content cluster
- [ ] M7 — Export guide
- [ ] M8 — Wrapped story pack and attribution
- [ ] M9 — Public-profile acquisition
- [ ] M10 — Manual Cleaner review
- [ ] M11 — Archive health
- [ ] M12 — Explicit local snapshot vault
- [ ] M13 — Saved-snapshot history
- [ ] M14 — Event-only analytics
- [ ] M15 — Indexing readiness
- [ ] M16 — Trust pages
- [ ] M17 — Final audit

## Baseline findings

The production homepage responds over HTTPS through Cloudflare. On 2026-09-27 its HTML still advertised `http://localhost:3000/` as canonical and `noindex, follow`. M1/M2 must correct the build configuration and verify the deployed output before indexing submission.

All 15 checked production routes/assets respond with HTTP 200. The expanded local browser sweep exposed a Windows Next.js static-export bug: nested RSC segment files caused prefetch 404s. A postbuild normalizer now copies those payloads to the dotted paths requested by the router without modifying their content or overwriting conflicts. The route sweep passes with zero failed responses after this fix. This is tracked upstream at https://github.com/vercel/next.js/issues/92339.

INS-6 adds private optional connection insights on top of the core MVP. Physical Android/iPhone, Safari, genuine HTML export and a second genuine historical export remain external validation gaps; Chromium emulation and synthetic fixtures do not satisfy those claims.
