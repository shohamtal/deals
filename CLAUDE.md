# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **frontend-only, no-build** static site ("Deals" / "דילים") that displays watch listings read **live and read-only** from a public Google Sheet. Hosted on GitHub Pages at https://shohamtal.github.io/deals/ (repo `shohamtal/deals`). Three files do everything: `index.html`, `styles.css`, `app.js`. There is no framework, bundler, package.json, or transpile step — edit the files directly.

## Develop / deploy

```bash
# Local preview (open http://localhost:8777)
python3 -m http.server 8777

# Deploy = commit to main + push; GitHub Pages rebuilds in ~1–2 min.
git add -A && git commit -m "..." && git push origin main
```

**Cache-busting is mandatory on every deploy.** GitHub Pages serves assets with `Cache-Control: max-age=600`, so browsers run a stale `app.js`/`styles.css` for up to 10 minutes after a push. `index.html` references them as `app.js?v=N` and `styles.css?v=N` — **bump `N` on both** whenever you change JS or CSS, or users won't see the change (this has bitten us repeatedly). After deploying, verify with:

```bash
curl -s "https://shohamtal.github.io/deals/?x=$(date +%s)" | grep -o "app.js?v=[0-9]*"
```

## Verifying changes (no committed test suite)

There is no test runner in the repo. The effective workflow this project uses:

- **Logic / behavior**: load `index.html` + `app.js` in **jsdom** with `window.fetch` mocked to return a CSV fixture, then drive the DOM and assert. Capture a fixture once with:
  `curl -sL "https://docs.google.com/spreadsheets/d/1jbke0dmA01rr-eTtHJ7GHZK4ULVIXi3dlR1P9k5BUWc/export?format=csv&gid=0" -o fixture.csv`
  Keep these throwaway scripts in the scratchpad, not the repo. Cross-check counts against ground truth computed directly from the CSV.
- **CSS / layout / RTL**: render a minimal repro (or the real page) with headless Chrome and screenshot it — layout bugs here are invisible to jsdom (jsdom has no layout engine):
  `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu --screenshot=out.png "file://.../repro.html"`
  To inspect why an element looks wrong, have the page print `getComputedStyle`/`getBoundingClientRect` into the DOM and screenshot that (this is how the `w=0` label bug was found).
- `node --check app.js` for a quick syntax gate.

## Data source: CSV export, NOT gviz

`loadData()` fetches the sheet via the **CSV export endpoint** (`/export?format=csv&gid=<gid>`), parses it with the hand-rolled `parseCSV`, and maps columns **by header name**. Do not switch to the gviz endpoint (`/gviz/tq`) — it returned a stale, partial, column-misaligned snapshot for this sheet (wrong row counts, garbage in columns). Fetch uses `cache: 'no-store'` + a `&_=Date.now()` buster so every load is fresh. The sheet is shared "anyone with link · Viewer"; the site only issues GETs and can never write.

Only the **USD** and **NIS (₪)** prices are ever shown; the sheet's other currency columns (yen/aed/euro) are ignored. The **price range filter and price sort operate on NIS**, not USD.

## Architecture (all in app.js)

- **Categories / tabs** — `CATEGORIES` is the single source of truth. Each entry maps a tab to one sheet tab (`sheetId` + `gid`), a `parseRow` (header-name → common item shape) and a `card` template; optional `headerMap` for non-standard headers. A `comingSoon: true` entry renders a disabled "soon" tab. Filter fields marked `data-only="<cat id>"` in `index.html` show only on that tab (`applyCatVisibility`). **Cars** reads the `cars` tab (`gid=140391439`), written by web-automation2's cars finder; car-only filters are model, hand (multi-selects) and `yearMin`/`yearMax`/`maxKm` (same names in URL + saved searches).
- **i18n** — `I18N` holds Hebrew (default, **RTL**) and English (LTR). Static UI text is driven by `data-i18n` / `data-i18n-ph` / `data-i18n-title` attributes filled by `applyStaticI18n()`. `setLanguage()` flips `dir`/`lang`, re-runs translations, and re-renders. Only the small fixed data sets **country** and **condition** are translated (`VALUE_MAPS` + `displayVal`); brands/models/sources are proper nouns left as-is.
- **Filter state ↔ URL** — every filter (search, exclude, brand/country/source multiselects, condition, price min/max, date from/to, sort, priced toggle) is serialized to the query string by `syncUrl()` and restored by `restoreFromUrl()`. This makes views shareable and is the substrate for saved searches.
- **Saved searches** — `currentFilterQuery()` serializes the current filters (that same query string, minus lang/cat/page); saved to `localStorage` (`deals-saved-searches`, max 20). `applyFilterQuery()` restores one.
- **Date range** — defaults to the **last 3 months** on fresh load (`setDefaultDates`) unless the URL carries `from`/`to`; Reset and category-switch restore that default; saved searches use their own stored dates.
- **Shabbat gate** — `boot()` runs before `init()`. It checks the Hebcal Shabbat feed (Jerusalem candle-lighting → havdalah, compared as absolute instants so it closes for all visitors during Israel's Shabbat), and if inside the window replaces the page with the candle screen and schedules a reload after havdalah. It **fails open** (shows the site) if Hebcal is unreachable. `boot()` is the entry point at the bottom of the file, not `init()`.
- **Custom dropdowns** — brand/country/source use `createMultiSelect` (checkbox + search popup); language and saved-searches are similar popups. All are closed by one shared document-click handler in `setupMultiSelects`.

## Car colours & edit mode (the only write path)

- Cars carry `exterior` (column `exterior_color`: dealer data / registry / Yad2) and `seat` (column `seat_color`, parsed from Facebook ad text). Manual values live in the **`cars-notes`** tab (`gid=154560499`, one row per licence `plate`), joined in `joinNotes()`; a note overrides the scraped value. Filters `ext`/`seat` include `__none` = empty cell ("טרם סווג", not classified yet) — distinct from the explicit value `other` ("אחר", looked but couldn't tell). There is deliberately no "hidden" flag — choosing a seat colour that the saved filter excludes is what hides a car; rows are never deleted (price history).
- **Previous ownership** (`ownership` chain + `prev_ownership` list, from the government vehicle registry via web-automation2) → card row + `own` filter (matches any of the car's types). Each card has a yellow licence-plate chip (a `span`, opened by the grid click handler since the card is already an `<a>`) linking to `https://meshumeshet.com/c/<plate>`.
- **Writes** go only through the Apps Script web app in `apps-script/notes.gs` (bound to the sheet, runs as the owner, checks `EDIT_PASSWORD` from Script Properties, whitelists field/value). The site POSTs text/plain JSON to the web-app `/exec` URL (no CORS preflight). Neither the URL nor the password is in the repo (owner's choice; local copy in gitignored `.secrets.local`): both are typed once into the edit dialog and kept in `localStorage` (`deals-edit-endpoint`, `deals-edit-pw`) after a successful `ping`.
- ✏️ Edit (Cars only) → pick exterior/seat → the grid shows only cars missing that value, each with a palette; a tap saves and fades the card (it isn't re-filtered under the finger).

## Hide / "not interested" (Cars, client-only)

Each car card has a ✕ (`hide-btn`) that adds the car's `plate` (or Yad2 ad token) to `localStorage['deals-hidden-cars']` and drops it from the view in place (`render({keepScroll:true})`). Nothing is written to the sheet — it's per browser. The "הצג מוסתרים (N)" toggle in the results bar flips the view to *only* hidden cars, each with "↩︎ החזר" to unhide. Hidden cars are excluded in edit mode too. Not part of the URL or saved searches.

## Deal score (Cars)

`scoreDeals()` fits a log-linear price model live in the browser on every car in the sheet (`ln price ~ year + km/10k + ex-leasing + ex-rental/company + premium trim (Signature/Premium/Pure) + basic trim (Comfort)`; Executive/Luxury = baseline — trims were bucketed from the data's residuals), drops >2.5σ outliers and refits. `deal` = (expected − price)/expected → chip: 🔥 ≥15% below, green ≥5% below, grey ±5% "market price", red ≥5% above; hover/tap on the chip opens `dealExplain()`: reference car (2020, 100k km, private, Executive) price, each factor’s % effect, expected vs asking. Sort `deal_desc` = best value. Needs ≥20 scorable cars (price+year+km). Coefficients are logged to the console (`deal model`).

## Gotchas

- Content derived from the sheet is untrusted: always route text through `escapeHtml` and any `href`/`src` through `safeUrl` (blocks `javascript:`/`data:`).
- `.filters input { width: 100% }` applies to **every** input inside the filter bar, including checkboxes and the saved-search name field — scope overrides with a more specific selector (e.g. `.filters .ms-option input { width: auto }`) when adding controls there.
- RTL: use logical CSS properties (`inset-inline-start/end`, `margin-inline-start`, `text-align: start`) so components flip correctly between Hebrew and English.
