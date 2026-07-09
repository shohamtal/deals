/* Watch Deals — read-only frontend.
 * Reads a public Google Sheet via the gviz query endpoint (plain GET, no auth,
 * no API key, no write scope). Nothing here can modify the sheet. */

'use strict';

// ---- Config ----
const SHEET_ID = '1jbke0dmA01rr-eTtHJ7GHZK4ULVIXi3dlR1P9k5BUWc';
const GID = '0'; // "watches" tab
const PAGE_SIZE = 50;
const GVIZ_URL =
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${GID}`;

// Column indexes in the sheet (0-based).
const COL = {
  timestamp: 0, source: 1, country: 2, brand: 3, model: 4,
  price_usd: 5, price_nis: 6, url: 10, image_url: 11,
  description: 12, condition: 13,
};

// ---- State ----
let ALL = [];       // all parsed listings
let VIEW = [];      // filtered + sorted
let page = 1;

// ---- DOM ----
const el = (id) => document.getElementById(id);
const grid = el('grid');
const controls = {
  q: el('q'), brand: el('brand'), country: el('country'),
  source: el('source'), condition: el('condition'),
  minPrice: el('minPrice'), maxPrice: el('maxPrice'),
  sort: el('sort'), hasPrice: el('hasPriceChk'),
};

// ---- Helpers ----
function parsePrice(raw) {
  if (raw === null || raw === undefined) return null;
  const n = parseFloat(String(raw).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

const fmtUSD = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
});
const fmtNIS = new Intl.NumberFormat('he-IL', {
  style: 'currency', currency: 'ILS', maximumFractionDigits: 0,
});

function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Only allow http(s) URLs into href/src — blocks javascript:/data: injection
// from the (user-controlled, but still untrusted) sheet cells.
function safeUrl(u) {
  const s = String(u || '').trim();
  return /^https?:\/\//i.test(s) ? s : '';
}

// ---- Fetch & parse gviz ----
async function loadData() {
  const res = await fetch(GVIZ_URL, { method: 'GET' });
  if (!res.ok) throw new Error(`Sheet request failed (HTTP ${res.status})`);
  const text = await res.text();
  const json = JSON.parse(text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1));
  const rows = json.table.rows || [];

  const cell = (r, i) => {
    const c = r.c && r.c[i];
    return c && c.v !== null && c.v !== undefined ? c.v : '';
  };

  const list = [];
  for (const r of rows) {
    const ts = String(cell(r, COL.timestamp)).trim();
    if (!ts || ts.toLowerCase() === 'timestamp') continue; // skip header / blanks
    const url = String(cell(r, COL.url)).trim();
    if (!url) continue;
    list.push({
      timestamp: ts,
      time: Date.parse(ts) || 0,
      source: String(cell(r, COL.source)).trim(),
      country: String(cell(r, COL.country)).trim(),
      brand: String(cell(r, COL.brand)).trim() || 'Unknown',
      model: String(cell(r, COL.model)).trim(),
      priceUsd: parsePrice(cell(r, COL.price_usd)),
      priceNis: parsePrice(cell(r, COL.price_nis)),
      url,
      image: String(cell(r, COL.image_url)).trim(),
      description: String(cell(r, COL.description)).trim(),
      condition: String(cell(r, COL.condition)).trim(),
    });
  }
  return list;
}

// ---- Filter dropdown population ----
function fillSelect(select, values, keepFirst = true) {
  const first = keepFirst ? select.querySelector('option') : null;
  select.innerHTML = '';
  if (first) select.appendChild(first);
  values.forEach((v) => {
    const o = document.createElement('option');
    o.value = v; o.textContent = v;
    select.appendChild(o);
  });
}

function buildFilters() {
  const uniq = (key) =>
    [...new Set(ALL.map((x) => x[key]).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
  fillSelect(controls.brand, uniq('brand'));
  fillSelect(controls.country, uniq('country'));
  fillSelect(controls.source, uniq('source'));
  fillSelect(controls.condition, uniq('condition'));
}

// ---- Filtering + sorting ----
function applyFilters() {
  const q = controls.q.value.trim().toLowerCase();
  const brand = controls.brand.value;
  const country = controls.country.value;
  const source = controls.source.value;
  const condition = controls.condition.value;
  const min = parsePrice(controls.minPrice.value);
  const max = parsePrice(controls.maxPrice.value);
  const onlyPriced = controls.hasPrice.checked;

  VIEW = ALL.filter((w) => {
    if (brand && w.brand !== brand) return false;
    if (country && w.country !== country) return false;
    if (source && w.source !== source) return false;
    if (condition && w.condition !== condition) return false;
    if (onlyPriced && w.priceUsd == null && w.priceNis == null) return false;
    if (min != null && !(w.priceUsd != null && w.priceUsd >= min)) return false;
    if (max != null && !(w.priceUsd != null && w.priceUsd <= max)) return false;
    if (q) {
      const hay = `${w.brand} ${w.model} ${w.description} ${w.source} ${w.country}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  sortView();
  page = 1;
  syncUrl();
  render();
}

function sortView() {
  const mode = controls.sort.value;
  const priceKey = (w) => (w.priceUsd == null ? Infinity : w.priceUsd); // missing prices last
  const cmp = {
    date_desc: (a, b) => b.time - a.time,
    date_asc: (a, b) => a.time - b.time,
    price_asc: (a, b) => priceKey(a) - priceKey(b),
    price_desc: (a, b) => (b.priceUsd ?? -Infinity) - (a.priceUsd ?? -Infinity),
    brand_asc: (a, b) => a.brand.localeCompare(b.brand) || b.time - a.time,
  }[mode] || ((a, b) => b.time - a.time);
  VIEW.sort(cmp);
}

// ---- Render ----
function cardHtml(w) {
  const imgUrl = safeUrl(w.image);
  const linkUrl = safeUrl(w.url);
  const img = imgUrl
    ? `<img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(w.brand + ' ' + w.model)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
       <div class="no-img" style="display:none">⌚</div>`
    : `<div class="no-img">⌚</div>`;

  const prices = [];
  if (w.priceUsd != null) prices.push(`<span class="price usd">${fmtUSD.format(w.priceUsd)}</span>`);
  if (w.priceNis != null) prices.push(`<span class="price nis">${fmtNIS.format(w.priceNis)}</span>`);
  const priceBlock = prices.length
    ? `<div class="price-row">${prices.join('')}</div>`
    : `<div class="price-row"><span class="price-none">Price on request</span></div>`;

  const condBadge = w.condition ? `<span class="badge-condition">${escapeHtml(w.condition)}</span>` : '';
  const countryBadge = w.country ? `<span class="badge-country">${escapeHtml(w.country)}</span>` : '';
  const desc = w.description && w.description.toLowerCase() !== (w.brand + ' ' + w.model).toLowerCase()
    ? `<div class="desc">${escapeHtml(w.description)}</div>` : '';

  const cardTag = linkUrl ? 'a' : 'div';
  const hrefAttr = linkUrl ? ` href="${escapeHtml(linkUrl)}" target="_blank" rel="noopener noreferrer"` : '';

  return `
  <${cardTag} class="card"${hrefAttr}>
    <div class="card-img-wrap">
      ${img}
      ${condBadge}
      ${countryBadge}
    </div>
    <div class="card-body">
      <div class="card-brand"><span class="brand-name">${escapeHtml(w.brand)}</span></div>
      <div class="card-model">${escapeHtml(w.model || '—')}</div>
      ${priceBlock}
      ${desc}
      <div class="card-meta">
        <div class="row"><span class="label">Source</span><span class="val">${escapeHtml(w.source || '—')}</span></div>
        <div class="row"><span class="label">Country</span><span class="val">${escapeHtml(w.country || '—')}</span></div>
        <div class="row"><span class="label">Listed</span><span class="val">${escapeHtml(fmtDate(w.timestamp))}</span></div>
        <div class="open-hint">Open listing ↗</div>
      </div>
    </div>
  </${cardTag}>`;
}

function render() {
  const total = VIEW.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > pages) page = pages;
  const start = (page - 1) * PAGE_SIZE;
  const slice = VIEW.slice(start, start + PAGE_SIZE);

  el('emptyState').hidden = total !== 0;
  grid.innerHTML = slice.map(cardHtml).join('');

  el('resultsSummary').textContent = total
    ? `Showing ${start + 1}–${start + slice.length} of ${total.toLocaleString()} watches`
    : '';

  renderPagination(pages);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderPagination(pages) {
  const nav = el('pagination');
  if (pages <= 1) { nav.innerHTML = ''; return; }

  const btn = (label, p, opts = {}) => {
    const cur = opts.current ? ' aria-current="true"' : '';
    const dis = opts.disabled ? ' disabled' : '';
    return `<button type="button" data-page="${p}"${cur}${dis}>${label}</button>`;
  };

  const parts = [btn('‹ Prev', page - 1, { disabled: page === 1 })];
  const nums = new Set([1, pages, page, page - 1, page + 1, page - 2, page + 2]);
  let last = 0;
  [...nums].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b).forEach((n) => {
    if (n - last > 1) parts.push('<span class="ellipsis">…</span>');
    parts.push(btn(String(n), n, { current: n === page }));
    last = n;
  });
  parts.push(btn('Next ›', page + 1, { disabled: page === pages }));
  nav.innerHTML = parts.join('');

  nav.querySelectorAll('button[data-page]').forEach((b) => {
    b.addEventListener('click', () => {
      const p = parseInt(b.dataset.page, 10);
      if (!b.disabled && p !== page) { page = p; syncUrl(); render(); }
    });
  });
}

// ---- URL state (shareable / survives refresh) ----
function syncUrl() {
  const p = new URLSearchParams();
  if (controls.q.value.trim()) p.set('q', controls.q.value.trim());
  if (controls.brand.value) p.set('brand', controls.brand.value);
  if (controls.country.value) p.set('country', controls.country.value);
  if (controls.source.value) p.set('source', controls.source.value);
  if (controls.condition.value) p.set('condition', controls.condition.value);
  if (controls.minPrice.value) p.set('min', controls.minPrice.value);
  if (controls.maxPrice.value) p.set('max', controls.maxPrice.value);
  if (controls.sort.value !== 'date_desc') p.set('sort', controls.sort.value);
  if (controls.hasPrice.checked) p.set('priced', '1');
  if (page > 1) p.set('page', String(page));
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

function restoreFromUrl() {
  const p = new URLSearchParams(location.search);
  const set = (ctrl, key) => { if (p.has(key)) ctrl.value = p.get(key); };
  set(controls.q, 'q');
  set(controls.brand, 'brand');
  set(controls.country, 'country');
  set(controls.source, 'source');
  set(controls.condition, 'condition');
  set(controls.minPrice, 'min');
  set(controls.maxPrice, 'max');
  set(controls.sort, 'sort');
  controls.hasPrice.checked = p.get('priced') === '1';
  const pg = parseInt(p.get('page'), 10);
  if (pg > 0) page = pg;
}

// ---- Wire up ----
function bindEvents() {
  let t;
  const debounced = () => { clearTimeout(t); t = setTimeout(applyFilters, 200); };
  controls.q.addEventListener('input', debounced);
  controls.minPrice.addEventListener('input', debounced);
  controls.maxPrice.addEventListener('input', debounced);
  ['brand', 'country', 'source', 'condition', 'sort'].forEach((k) =>
    controls[k].addEventListener('change', applyFilters));
  controls.hasPrice.addEventListener('change', applyFilters);

  el('reset').addEventListener('click', () => {
    controls.q.value = '';
    ['brand', 'country', 'source', 'condition'].forEach((k) => (controls[k].value = ''));
    controls.minPrice.value = '';
    controls.maxPrice.value = '';
    controls.sort.value = 'date_desc';
    controls.hasPrice.checked = false;
    applyFilters();
  });
}

function showSkeletons() {
  grid.innerHTML = Array.from({ length: 9 }).map(() => `
    <div class="card skeleton">
      <div class="card-img-wrap"></div>
      <div class="sk-line" style="width:50%"></div>
      <div class="sk-line" style="width:80%"></div>
      <div class="sk-line" style="width:35%"></div>
    </div>`).join('');
}

async function init() {
  bindEvents();
  restoreFromUrl();
  showSkeletons();
  el('headerStatus').textContent = 'Loading live data…';
  const savedPage = page;
  try {
    ALL = await loadData();
    buildFilters();
    restoreFromUrl(); // re-apply now that dropdown options exist
    page = savedPage;
    el('totalCount').textContent = ALL.length.toLocaleString();
    el('headerStatus').textContent = '';
    applyFilters();
    // applyFilters resets page to 1; honor a restored page after first render
    if (savedPage > 1) { page = savedPage; render(); }
  } catch (err) {
    console.error(err);
    el('headerStatus').textContent = '';
    grid.innerHTML = `<div class="error-box">
      <strong>Couldn't load the data.</strong><br>
      ${escapeHtml(err.message)}<br><br>
      The Google Sheet must be shared as “Anyone with the link · Viewer”. Please retry in a moment.
    </div>`;
    el('pagination').innerHTML = '';
  }
}

init();
