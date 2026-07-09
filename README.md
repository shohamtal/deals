# ⌚ Watch Deals

A static, **frontend-only** site that shows second-hand / pre-owned watch listings
collected from around the world. Filter, sort, and browse; click any watch to open
its original listing in a new tab.

## How it works

- Data is read **live** and **read-only** from a public Google Sheet via the
  [gviz query endpoint](https://developers.google.com/chart/interactive/docs/dev/implementing_data_source)
  — a plain `GET` with no API key, no OAuth token, and no write scope. The page
  cannot modify the sheet.
- No backend, no build step. Just static `index.html` / `styles.css` / `app.js`,
  which is why it can be hosted on GitHub Pages.
- Prices are shown in **USD** and **₪ (NIS)** only; other currency columns in the
  sheet are ignored.

## Features

- Filters (on top): search, brand, country, source, condition, price range, and a
  "only listings with a price" toggle.
- Sort: date (newest first — default), date oldest, price low→high, price high→low, brand A–Z.
- Grid of 3 cards per row (responsive down to 1 on mobile).
- Pagination, 50 listings per page.
- Filter/sort/page state is reflected in the URL, so views are shareable.

## Local development

```bash
python3 -m http.server 8777
# open http://localhost:8777
```

## Data source

The sheet must be shared as **"Anyone with the link · Viewer"** for the browser to
read it. The spreadsheet id and tab gid are set at the top of `app.js`.
