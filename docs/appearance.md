# Shared appearance

Light is the first-visit default, including on devices using OS dark mode. Its
palette comes from the original InstaScope styles at
`2fa542902e153ac33a756ec75b8b72e7629c0677`: paper `#faf9f5`, ink `#263b30`,
muted `#657168`, line `#e1e5dc`, lime `#d9efa8` and white `#ffffff`.
Dark retains the charcoal design introduced in INS-148. Both use the current
shared shell, components and semantic CSS tokens.

The shared header's **Dark mode** switch shows the current Light/Dark setting.
One `data-theme` attribute on `<html>` controls both Instagram and WhatsApp.
The only appearance value persisted is `light` or `dark` under the localStorage
key `instascope-theme`. It is not connected to archive state or analytics.

A small synchronous head initializer reads the allowlisted value before the
first body paint. It uses the existing static-export CSP, which already permits
Next.js inline initialization; no CSP permission was added. React hydrates the
shared control from the root attribute. The static HTML and no-JavaScript
fallback are Light. With unavailable storage, the default is Light and the
switch still works for the current document. Reload persistence requires
available browser storage. Changes in another tab are reflected locally.

Theme selection does not change parsing, calculations, storage schemas,
share/export artwork, routes, indexing, release gates or telemetry. Wrapped
PNG/ZIP artwork keeps its intentional palette. INS-154 separately registers
WhatsApp's public tools, guide hub and ten guides for production indexing;
theme selection does not affect that policy. Preview/unknown contexts retain
noindex/nofollow and an empty sitemap. See [search readiness](search-readiness.md).

Browser coverage deliberately exercises both themes, first paint, blocked
storage, keyboard/mobile operation and active datasets. Production/preview
visual comparisons run both themes independently; they complement functional
import, error recovery, filters, Vault, comparison and download checks.
