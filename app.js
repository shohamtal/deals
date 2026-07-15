/* Deals — frontend-only, read-only, bilingual (Hebrew default / English).
 * Reads public Google Sheet tabs via the gviz endpoint (plain GET, no auth,
 * no API key, no write scope). Nothing here can modify the sheet.
 *
 * Add a new deal category = add an entry to CATEGORIES (each maps to one sheet
 * tab + its column layout). UI strings live in I18N. */

'use strict';

// ---- Categories (tabs) ----
const CATEGORIES = [
  {
    id: 'watches',
    icon: '⌚',
    label: { he: 'שעונים', en: 'Watches' },
    sheetId: '1jbke0dmA01rr-eTtHJ7GHZK4ULVIXi3dlR1P9k5BUWc',
    gid: '0', // "watches" tab
    // Columns are read from the CSV by header name. Only add a headerMap entry
    // (logicalName: 'Actual Header') if a future sheet uses different headers.
    headerMap: {},
  },
  // Future tab — flip `comingSoon` off and fill in sheetId/gid:
  { id: 'cars', icon: '🚗', label: { he: 'מכוניות', en: 'Cars' }, comingSoon: true },
];

const PAGE_SIZE = 50;
const THEME_KEY = 'deals-theme';
const LANG_KEY = 'deals-lang';
const SAVED_KEY = 'deals-saved-searches';
const SAVED_MAX = 20;

// ---- Translations ----
const I18N = {
  he: {
    dir: 'rtl', htmlLang: 'he', flag: '🇮🇱', docTitle: 'דילים', brand: 'דילים',
    strings: {
      filtersToggle: 'סינון', searchLabel: 'חיפוש', searchPlaceholder: 'מותג, דגם, תיאור…',
      excludeLabel: 'לא כולל', excludePlaceholder: 'מילים להחרגה (מופרדות בפסיק)…',
      savedBtn: '★ שמורים', savedNamePh: 'שם החיפוש', savedAdd: 'שמירה',
      savedEmpty: 'אין חיפושים שמורים', savedDefault: 'חיפוש',
      savedMax: 'הגעת ל‑20 חיפושים. מחקו אחד כדי לשמור חדש.',
      savedNoFilters: 'לא הוגדר סינון לשמירה.',
      savedDelConfirm: 'למחוק את החיפוש השמור?',
      brandLabel: 'מותג', countryLabel: 'מדינה', sourceLabel: 'מקור', conditionLabel: 'מצב',
      anyCondition: 'כל המצבים', minPrice: 'מ־₪', maxPrice: 'עד ₪', sortLabel: 'מיון',
      dateFromLabel: 'מתאריך', dateToLabel: 'עד תאריך',
      sort_date_desc: 'תאריך · מהחדש לישן', sort_date_asc: 'תאריך · מהישן לחדש',
      sort_price_asc: 'מחיר · מהנמוך לגבוה', sort_price_desc: 'מחיר · מהגבוה לנמוך',
      sort_brand_asc: 'מותג · א׳–ת׳',
      reset: 'איפוס', resetTitle: 'ניקוי כל הסינונים',
      themeToggle: 'החלפת מצב תצוגה',
      onlyPriced: 'רק מודעות עם מחיר',
      allBrands: 'כל המותגים', allCountries: 'כל המדינות', allSources: 'כל המקורות',
      msFilter: 'סינון…', msNoMatches: 'אין התאמות', msClear: 'ניקוי',
      msSelected: '{n} נבחרו',
      results: 'מציג {a}–{b} מתוך {n} מודעות', listingsWord: 'מודעות',
      empty: 'אין מודעות התואמות את הסינון.', clearFilters: 'ניקוי סינונים',
      priceOnRequest: 'מחיר לפי פנייה', openListing: 'פתיחת המודעה ↗',
      metaSource: 'מקור', metaCountry: 'מדינה', metaListed: 'פורסם',
      prev: 'הקודם', next: 'הבא',
      loading: 'טוען נתונים חיים…',
      errTitle: 'לא ניתן לטעון את הנתונים.',
      errBody: 'גיליון Google חייב להיות משותף כ״כל מי שיש לו הקישור · צופה״. נסו שוב בעוד רגע.',
      footer: 'תצוגה לקריאה בלבד מתוך גיליון Google חי · הנתונים מתרעננים בכל טעינת עמוד. מחירים מוצגים בדולר ($) ובש״ח (₪) בלבד.',
    },
  },
  en: {
    dir: 'ltr', htmlLang: 'en', flag: '🇺🇸', docTitle: 'Deals', brand: 'Deals',
    strings: {
      filtersToggle: 'Filters', searchLabel: 'Search', searchPlaceholder: 'Brand, model, description…',
      excludeLabel: 'Exclude', excludePlaceholder: 'Words to exclude (comma-separated)…',
      savedBtn: '★ Saved', savedNamePh: 'Search name', savedAdd: 'Save',
      savedEmpty: 'No saved searches', savedDefault: 'Search',
      savedMax: 'Reached 20 searches. Delete one to save a new one.',
      savedNoFilters: 'Set a filter before saving.',
      savedDelConfirm: 'Delete this saved search?',
      brandLabel: 'Brand', countryLabel: 'Country', sourceLabel: 'Source', conditionLabel: 'Condition',
      anyCondition: 'Any condition', minPrice: 'Min ₪', maxPrice: 'Max ₪', sortLabel: 'Sort by',
      dateFromLabel: 'From date', dateToLabel: 'To date',
      sort_date_desc: 'Date · newest first', sort_date_asc: 'Date · oldest first',
      sort_price_asc: 'Price · low to high', sort_price_desc: 'Price · high to low',
      sort_brand_asc: 'Brand · A–Z',
      reset: 'Reset', resetTitle: 'Clear all filters',
      themeToggle: 'Toggle light/dark theme',
      onlyPriced: 'Only listings with a price',
      allBrands: 'All brands', allCountries: 'All countries', allSources: 'All sources',
      msFilter: 'Filter…', msNoMatches: 'No matches', msClear: 'Clear',
      msSelected: '{n} selected',
      results: 'Showing {a}–{b} of {n} listings', listingsWord: 'listings',
      empty: 'No listings match your filters.', clearFilters: 'Clear filters',
      priceOnRequest: 'Price on request', openListing: 'Open listing ↗',
      metaSource: 'Source', metaCountry: 'Country', metaListed: 'Listed',
      prev: '‹ Prev', next: 'Next ›',
      loading: 'Loading live data…',
      errTitle: "Couldn't load the data.",
      errBody: 'The Google Sheet must be shared as “Anyone with the link · Viewer”. Please retry in a moment.',
      footer: 'Read-only view of a live Google Sheet · data refreshes on page load. Prices shown in USD ($) and ₪ (NIS) only.',
    },
  },
};

// Data-value translations (small fixed sets). Proper nouns (brand/source/model) stay as-is.
const VALUE_MAPS = {
  he: {
    country: { Israel: 'ישראל', Japan: 'יפן', Dubai: 'דובאי', France: 'צרפת', Cyprus: 'קפריסין', Greece: 'יוון' },
    condition: { 'second-hand': 'יד שנייה', 'pre-owned': 'משומש' },
  },
};

// ---- State ----
let lang = 'he';
let activeCat = CATEGORIES[0];
let ALL = [];
let VIEW = [];
let page = 1;

// ---- DOM ----
const el = (id) => document.getElementById(id);
const grid = el('grid');
const controls = {
  q: el('q'), qx: el('qx'), condition: el('condition'),
  minPrice: el('minPrice'), maxPrice: el('maxPrice'),
  dateFrom: el('dateFrom'), dateTo: el('dateTo'),
  sort: el('sort'), hasPrice: el('hasPriceChk'),
};
const ms = {}; // multi-select filters: brand, country, source

// ---- i18n helpers ----
function dict() { return I18N[lang].strings; }
function t(key, params) {
  let s = dict()[key] || key;
  if (params) for (const k in params) s = s.replace(`{${k}}`, params[k]);
  return s;
}
function displayVal(kind, raw) {
  const m = VALUE_MAPS[lang] && VALUE_MAPS[lang][kind];
  return (m && m[raw]) || raw;
}

// ---- Theme (light default) ----
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem(THEME_KEY, theme); } catch (_) {}
  el('themeToggle').textContent = theme === 'dark' ? '☀️' : '🌙';
}
function initTheme() {
  let saved = 'light';
  try { saved = localStorage.getItem(THEME_KEY) || 'light'; } catch (_) {}
  applyTheme(saved === 'dark' ? 'dark' : 'light');
  el('themeToggle').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  });
}

// ---- Formatting ----
function parsePrice(raw) {
  if (raw === null || raw === undefined) return null;
  const n = parseFloat(String(raw).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}
const fmtUSD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtNIS = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 });
function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// YYYY-MM-DD for <input type="date">
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// Default date range = last 3 months (from 3 months ago through today).
function defaultDates() {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - 3);
  return { from: ymd(from), to: ymd(to) };
}
function setDefaultDates() {
  const dd = defaultDates();
  controls.dateFrom.value = dd.from;
  controls.dateTo.value = dd.to;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
// Only allow http(s) into href/src — blocks javascript:/data: from sheet cells.
function safeUrl(u) {
  const s = String(u || '').trim();
  return /^https?:\/\//i.test(s) ? s : '';
}

// Minimal RFC-4180 CSV parser: handles quoted fields, escaped quotes (""),
// and commas/newlines inside quotes.
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  const n = text.length;
  for (let i = 0; i < n; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQ = false; }
      } else { field += c; }
    } else if (c === '"') {
      inQ = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// ---- Multi-select dropdown (checkboxes + search) ----
function createMultiSelect(mount, { allLabel, texts, onChange }) {
  const selected = new Set();
  let options = [];          // [{value, count, label}]
  let labelByValue = new Map();
  const state = { allLabel, texts };

  mount.innerHTML = `
    <button type="button" class="ms-trigger"></button>
    <div class="ms-panel" role="listbox" aria-multiselectable="true">
      <input type="text" class="ms-search" autocomplete="off" />
      <div class="ms-list"></div>
      <div class="ms-empty" hidden></div>
      <div class="ms-foot"><button type="button" class="ms-clear"></button></div>
    </div>`;
  const trigger = mount.querySelector('.ms-trigger');
  const panel = mount.querySelector('.ms-panel');
  const search = mount.querySelector('.ms-search');
  const list = mount.querySelector('.ms-list');
  const empty = mount.querySelector('.ms-empty');
  const clearBtn = mount.querySelector('.ms-clear');

  function updateTrigger() {
    const n = selected.size;
    if (n === 0) { trigger.textContent = state.allLabel; trigger.classList.remove('has-sel'); }
    else if (n === 1) { trigger.textContent = labelByValue.get([...selected][0]) || [...selected][0]; trigger.classList.add('has-sel'); }
    else { trigger.textContent = state.texts.selected.replace('{n}', n); trigger.classList.add('has-sel'); }
  }
  function applyStaticTexts() {
    search.placeholder = state.texts.filter;
    empty.textContent = state.texts.noMatches;
    clearBtn.textContent = state.texts.clear;
  }
  function renderList() {
    const q = search.value.trim().toLowerCase();
    list.innerHTML = '';
    let shown = 0;
    options.forEach((opt) => {
      if (q && !opt.label.toLowerCase().includes(q)) return;
      shown++;
      const id = 'ms-' + Math.random().toString(36).slice(2, 9);
      const row = document.createElement('label');
      row.className = 'ms-option';
      row.htmlFor = id;
      row.innerHTML = `<input type="checkbox" id="${id}"${selected.has(opt.value) ? ' checked' : ''} />
        <span class="ms-label"></span><span class="ms-count">${opt.count}</span>`;
      row.querySelector('.ms-label').textContent = opt.label;
      row.querySelector('input').addEventListener('change', (e) => {
        if (e.target.checked) selected.add(opt.value); else selected.delete(opt.value);
        updateTrigger();
        onChange();
      });
      list.appendChild(row);
    });
    empty.hidden = shown !== 0;
  }
  function open() {
    document.querySelectorAll('.ms.open').forEach((m) => { if (m !== mount) m.classList.remove('open'); });
    mount.classList.add('open');
    search.value = '';
    renderList();
    search.focus();
  }
  function close() { mount.classList.remove('open'); }

  trigger.addEventListener('click', (e) => { e.stopPropagation(); mount.classList.contains('open') ? close() : open(); });
  search.addEventListener('input', renderList);
  search.addEventListener('click', (e) => e.stopPropagation());
  panel.addEventListener('click', (e) => e.stopPropagation());
  clearBtn.addEventListener('click', () => { selected.clear(); updateTrigger(); renderList(); onChange(); });
  mount.addEventListener('keydown', (e) => { if (e.key === 'Escape') { close(); trigger.focus(); } });

  applyStaticTexts();
  updateTrigger();

  return {
    setOptions(items) {
      options = items;
      labelByValue = new Map(items.map((o) => [o.value, o.label]));
      renderList(); updateTrigger();
    },
    getSelected() { return [...selected]; },
    setSelected(arr) { selected.clear(); (arr || []).forEach((v) => selected.add(v)); updateTrigger(); renderList(); },
    clear() { selected.clear(); updateTrigger(); renderList(); },
    refreshTexts({ allLabel, texts }) { state.allLabel = allLabel; state.texts = texts; applyStaticTexts(); updateTrigger(); },
  };
}

const MS_ALL_KEY = { brand: 'allBrands', country: 'allCountries', source: 'allSources' };
function msTexts() {
  return { filter: t('msFilter'), noMatches: t('msNoMatches'), clear: t('msClear'), selected: t('msSelected') };
}
function setupMultiSelects() {
  const apply = () => applyFilters();
  document.querySelectorAll('.ms[data-ms]').forEach((mount) => {
    const key = mount.dataset.ms;
    ms[key] = createMultiSelect(mount, { allLabel: t(MS_ALL_KEY[key]), texts: msTexts(), onChange: apply });
  });
  document.addEventListener('click', () => {
    document.querySelectorAll('.ms.open').forEach((m) => m.classList.remove('open'));
    el('lang').classList.remove('open');
    el('saved').classList.remove('open');
  });
}

// ---- Static text application ----
function applyStaticI18n() {
  document.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach((n) => { n.placeholder = t(n.dataset.i18nPh); });
  document.querySelectorAll('[data-i18n-title]').forEach((n) => { n.title = t(n.dataset.i18nTitle); });
}

// ---- Tabs ----
function renderTabs() {
  const nav = el('tabs');
  nav.innerHTML = '';
  CATEGORIES.forEach((cat) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tab' + (cat.comingSoon ? ' disabled' : '');
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(cat.id === activeCat.id && !cat.comingSoon));
    b.textContent = `${cat.icon} ${cat.label[lang]}`;
    if (cat.comingSoon) {
      const s = document.createElement('span');
      s.className = 'soon';
      s.textContent = lang === 'he' ? 'בקרוב' : 'soon';
      b.appendChild(s);
    } else {
      b.addEventListener('click', () => { if (cat.id !== activeCat.id) switchCategory(cat); });
    }
    nav.appendChild(b);
  });
}

function updateTagline() {
  el('tagline').textContent = `${activeCat.icon} ${activeCat.label[lang]} · ${ALL.length.toLocaleString()} ${t('listingsWord')}`;
}

async function switchCategory(cat) {
  activeCat = cat;
  page = 1;
  ['q', 'qx', 'condition', 'minPrice', 'maxPrice'].forEach((k) => { if (controls[k]) controls[k].value = ''; });
  setDefaultDates();
  controls.sort.value = 'date_desc';
  controls.hasPrice.checked = false;
  ['brand', 'country', 'source'].forEach((k) => ms[k] && ms[k].clear());
  renderTabs();
  await loadActive();
}

// ---- Filter option population ----
function fillSelect(select, items) {
  const first = select.querySelector('option'); // keep placeholder
  select.innerHTML = '';
  if (first) select.appendChild(first);
  items.forEach(({ value, label }) => {
    const o = document.createElement('option');
    o.value = value; o.textContent = label;
    select.appendChild(o);
  });
}

function buildFilters() {
  const counted = (key) => {
    const m = new Map();
    ALL.forEach((x) => { const v = x[key]; if (v) m.set(v, (m.get(v) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  };
  const toOpts = (key, translateKind) => counted(key).map(([value, count]) => ({
    value, count, label: translateKind ? displayVal(translateKind, value) : value,
  }));

  ms.brand.setOptions(toOpts('brand'));
  ms.country.setOptions(toOpts('country', 'country'));
  ms.source.setOptions(toOpts('source'));

  const condVal = controls.condition.value;
  fillSelect(controls.condition, counted('condition').map(([value]) => ({ value, label: displayVal('condition', value) })));
  controls.condition.value = condVal;
}

// ---- Filtering + sorting ----
function applyFilters() {
  const q = controls.q.value.trim().toLowerCase();
  const exTerms = controls.qx.value.toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
  const brandSet = new Set(ms.brand.getSelected());
  const countrySet = new Set(ms.country.getSelected());
  const sourceSet = new Set(ms.source.getSelected());
  const condition = controls.condition.value;
  const min = parsePrice(controls.minPrice.value);
  const max = parsePrice(controls.maxPrice.value);
  const onlyPriced = controls.hasPrice.checked;
  // date range (compare on local calendar days, inclusive)
  const fromMs = controls.dateFrom.value ? new Date(controls.dateFrom.value + 'T00:00:00').getTime() : null;
  const toMs = controls.dateTo.value ? new Date(controls.dateTo.value + 'T23:59:59.999').getTime() : null;

  VIEW = ALL.filter((w) => {
    if (brandSet.size && !brandSet.has(w.brand)) return false;
    if (countrySet.size && !countrySet.has(w.country)) return false;
    if (sourceSet.size && !sourceSet.has(w.source)) return false;
    if (condition && w.condition !== condition) return false;
    if (onlyPriced && w.priceUsd == null && w.priceNis == null) return false;
    if (min != null && !(w.priceNis != null && w.priceNis >= min)) return false;
    if (max != null && !(w.priceNis != null && w.priceNis <= max)) return false;
    if (fromMs != null && !(w.time && w.time >= fromMs)) return false;
    if (toMs != null && !(w.time && w.time <= toMs)) return false;
    if (q || exTerms.length) {
      const hay = `${w.brand} ${w.model} ${w.description} ${w.source} ${w.country}`.toLowerCase();
      if (q && !hay.includes(q)) return false;
      if (exTerms.length && exTerms.some((term) => hay.includes(term))) return false;
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
  const priceKey = (w) => (w.priceNis == null ? Infinity : w.priceNis); // sort by NIS, missing last
  const cmp = {
    date_desc: (a, b) => b.time - a.time,
    date_asc: (a, b) => a.time - b.time,
    price_asc: (a, b) => priceKey(a) - priceKey(b),
    price_desc: (a, b) => (b.priceNis ?? -Infinity) - (a.priceNis ?? -Infinity),
    brand_asc: (a, b) => a.brand.localeCompare(b.brand) || b.time - a.time,
  }[mode] || ((a, b) => b.time - a.time);
  VIEW.sort(cmp);
}

// ---- Fetch & parse the sheet as CSV (LIVE, never cached) ----
// The CSV export endpoint reflects true sheet content; the gviz endpoint was
// dropped because its cached snapshot returned partial rows for this sheet.
async function loadData(cat) {
  const base = `https://docs.google.com/spreadsheets/d/${cat.sheetId}/export?format=csv&gid=${cat.gid}`;
  const url = `${base}&_=${Date.now()}`; // cache-buster; paired with cache:no-store below
  const res = await fetch(url, { method: 'GET', cache: 'no-store' });
  if (!res.ok) throw new Error(`Sheet request failed (HTTP ${res.status})`);
  const text = await res.text();
  const rows = parseCSV(text);
  if (rows.length < 2) return [];

  const idx = {};
  rows[0].forEach((h, i) => { idx[String(h).trim()] = i; });
  const map = cat.headerMap || {};
  const col = (row, logical) => {
    const i = idx[map[logical] || logical];
    return i == null || row[i] == null ? '' : String(row[i]).trim();
  };

  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const ts = col(row, 'timestamp');
    if (!ts || ts.toLowerCase() === 'timestamp') continue;
    const u = col(row, 'url');
    if (!u) continue;
    out.push({
      timestamp: ts, time: Date.parse(ts) || 0,
      source: col(row, 'source'),
      country: col(row, 'country'),
      brand: col(row, 'brand') || 'Unknown',
      model: col(row, 'model'),
      priceUsd: parsePrice(col(row, 'price_usd')),
      priceNis: parsePrice(col(row, 'price_nis')),
      url: u,
      image: col(row, 'image_url'),
      description: col(row, 'description'),
      condition: col(row, 'condition'),
    });
  }
  return out;
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
    : `<div class="price-row"><span class="price-none">${escapeHtml(t('priceOnRequest'))}</span></div>`;

  const condBadge = w.condition ? `<span class="badge-condition">${escapeHtml(displayVal('condition', w.condition))}</span>` : '';
  const countryBadge = w.country ? `<span class="badge-country">${escapeHtml(displayVal('country', w.country))}</span>` : '';
  const desc = w.description && w.description.toLowerCase() !== (w.brand + ' ' + w.model).toLowerCase()
    ? `<div class="desc">${escapeHtml(w.description)}</div>` : '';

  const cardTag = linkUrl ? 'a' : 'div';
  const hrefAttr = linkUrl ? ` href="${escapeHtml(linkUrl)}" target="_blank" rel="noopener noreferrer"` : '';

  return `
  <${cardTag} class="card"${hrefAttr}>
    <div class="card-img-wrap">${img}${condBadge}${countryBadge}</div>
    <div class="card-body">
      <div class="card-brand"><span class="brand-name">${escapeHtml(w.brand)}</span></div>
      <div class="card-model">${escapeHtml(w.model || '—')}</div>
      ${priceBlock}
      ${desc}
      <div class="card-meta">
        <div class="row"><span class="label">${escapeHtml(t('metaSource'))}</span><span class="val">${escapeHtml(w.source || '—')}</span></div>
        <div class="row"><span class="label">${escapeHtml(t('metaCountry'))}</span><span class="val">${escapeHtml(displayVal('country', w.country) || '—')}</span></div>
        <div class="row"><span class="label">${escapeHtml(t('metaListed'))}</span><span class="val">${escapeHtml(fmtDate(w.timestamp))}</span></div>
        <div class="open-hint">${escapeHtml(t('openListing'))}</div>
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
    ? t('results', { a: start + 1, b: start + slice.length, n: total.toLocaleString() })
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
    return `<button type="button" data-page="${p}"${cur}${dis}>${escapeHtml(label)}</button>`;
  };
  const parts = [btn(t('prev'), page - 1, { disabled: page === 1 })];
  const nums = new Set([1, pages, page, page - 1, page + 1, page - 2, page + 2]);
  let last = 0;
  [...nums].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b).forEach((n) => {
    if (n - last > 1) parts.push('<span class="ellipsis">…</span>');
    parts.push(btn(String(n), n, { current: n === page }));
    last = n;
  });
  parts.push(btn(t('next'), page + 1, { disabled: page === pages }));
  nav.innerHTML = parts.join('');
  nav.querySelectorAll('button[data-page]').forEach((b) => {
    b.addEventListener('click', () => {
      const p = parseInt(b.dataset.page, 10);
      if (!b.disabled && p !== page) { page = p; syncUrl(); render(); }
    });
  });
}

// ---- URL state ----
function syncUrl() {
  const p = new URLSearchParams();
  if (lang !== 'he') p.set('lang', lang);
  if (activeCat.id !== CATEGORIES[0].id) p.set('cat', activeCat.id);
  if (controls.q.value.trim()) p.set('q', controls.q.value.trim());
  if (controls.qx.value.trim()) p.set('qx', controls.qx.value.trim());
  ms.brand.getSelected().forEach((v) => p.append('brand', v));
  ms.country.getSelected().forEach((v) => p.append('country', v));
  ms.source.getSelected().forEach((v) => p.append('source', v));
  if (controls.condition.value) p.set('condition', controls.condition.value);
  if (controls.minPrice.value) p.set('min', controls.minPrice.value);
  if (controls.maxPrice.value) p.set('max', controls.maxPrice.value);
  if (controls.dateFrom.value) p.set('from', controls.dateFrom.value);
  if (controls.dateTo.value) p.set('to', controls.dateTo.value);
  if (controls.sort.value !== 'date_desc') p.set('sort', controls.sort.value);
  if (controls.hasPrice.checked) p.set('priced', '1');
  if (page > 1) p.set('page', String(page));
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

function restoreFromUrl() {
  const p = new URLSearchParams(location.search);
  const set = (ctrl, key) => { if (ctrl && p.has(key)) ctrl.value = p.get(key); };
  set(controls.q, 'q');
  set(controls.qx, 'qx');
  if (p.has('brand')) ms.brand.setSelected(p.getAll('brand'));
  if (p.has('country')) ms.country.setSelected(p.getAll('country'));
  if (p.has('source')) ms.source.setSelected(p.getAll('source'));
  set(controls.condition, 'condition');
  set(controls.minPrice, 'min');
  set(controls.maxPrice, 'max');
  set(controls.dateFrom, 'from');
  set(controls.dateTo, 'to');
  set(controls.sort, 'sort');
  controls.hasPrice.checked = p.get('priced') === '1';
  const pg = parseInt(p.get('page'), 10);
  if (pg > 0) page = pg;
}

// ---- Language ----
function setLanguage(l, { rerender = true } = {}) {
  lang = I18N[l] ? l : 'he';
  try { localStorage.setItem(LANG_KEY, lang); } catch (_) {}
  const conf = I18N[lang];
  document.documentElement.lang = conf.htmlLang;
  document.documentElement.dir = conf.dir;
  document.title = conf.docTitle;
  el('brandTitle').textContent = `🏷️ ${conf.brand}`;
  el('langBtn').textContent = conf.flag;
  document.querySelectorAll('.lang-menu [data-lang]').forEach((b) =>
    b.setAttribute('aria-current', String(b.dataset.lang === lang)));

  applyStaticI18n();
  Object.keys(ms).forEach((k) => ms[k].refreshTexts({ allLabel: t(MS_ALL_KEY[k]), texts: msTexts() }));
  renderTabs();

  if (rerender && ALL.length) {
    buildFilters();      // re-translate option labels (selections preserved by value)
    updateTagline();
    render();            // re-render grid + summary + pagination in new language
    syncUrl();
  }
}

function setupLang() {
  const langEl = el('lang');
  el('langBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    langEl.classList.toggle('open');
    el('langBtn').setAttribute('aria-expanded', String(langEl.classList.contains('open')));
  });
  langEl.querySelector('.lang-menu').addEventListener('click', (e) => e.stopPropagation());
  langEl.querySelectorAll('[data-lang]').forEach((b) => {
    b.addEventListener('click', () => {
      langEl.classList.remove('open');
      if (b.dataset.lang !== lang) setLanguage(b.dataset.lang);
    });
  });
}

// ---- Saved searches (localStorage, up to SAVED_MAX) ----
// A saved search is the current filter state serialized as a query string
// (lang/cat/page excluded — those aren't part of "the search").
function currentFilterQuery() {
  const p = new URLSearchParams();
  if (controls.q.value.trim()) p.set('q', controls.q.value.trim());
  if (controls.qx.value.trim()) p.set('qx', controls.qx.value.trim());
  ms.brand.getSelected().forEach((v) => p.append('brand', v));
  ms.country.getSelected().forEach((v) => p.append('country', v));
  ms.source.getSelected().forEach((v) => p.append('source', v));
  if (controls.condition.value) p.set('condition', controls.condition.value);
  if (controls.minPrice.value) p.set('min', controls.minPrice.value);
  if (controls.maxPrice.value) p.set('max', controls.maxPrice.value);
  // Dates are intentionally NOT saved: a saved search captures watch
  // attributes only, and always opens on the sliding last-3-months window.
  if (controls.sort.value !== 'date_desc') p.set('sort', controls.sort.value);
  if (controls.hasPrice.checked) p.set('priced', '1');
  return p.toString();
}

function applyFilterQuery(qs) {
  const p = new URLSearchParams(qs);
  controls.q.value = p.get('q') || '';
  controls.qx.value = p.get('qx') || '';
  ms.brand.setSelected(p.getAll('brand'));
  ms.country.setSelected(p.getAll('country'));
  ms.source.setSelected(p.getAll('source'));
  controls.condition.value = p.get('condition') || '';
  controls.minPrice.value = p.get('min') || '';
  controls.maxPrice.value = p.get('max') || '';
  // Saved searches never carry dates — always open on the sliding default
  // window (last 3 months), even for searches saved before this change.
  setDefaultDates();
  controls.sort.value = p.get('sort') || 'date_desc';
  controls.hasPrice.checked = p.get('priced') === '1';
  applyFilters();
}

// Human summary of a saved query, for the list subtitle.
function describeQuery(qs) {
  const p = new URLSearchParams(qs);
  const parts = [];
  const b = p.getAll('brand'); if (b.length) parts.push(b.join(', '));
  const c = p.getAll('country'); if (c.length) parts.push(c.map((x) => displayVal('country', x)).join(', '));
  const s = p.getAll('source'); if (s.length) parts.push(s.join(', '));
  if (p.get('condition')) parts.push(displayVal('condition', p.get('condition')));
  if (p.get('q')) parts.push('“' + p.get('q') + '”');
  if (p.get('qx')) parts.push('−' + p.get('qx'));
  if (p.get('min') || p.get('max')) parts.push('₪' + (p.get('min') || '0') + '–' + (p.get('max') || '∞'));
  return parts.join(' · ');
}

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY)) || []; } catch (_) { return []; }
}
function storeSaved(arr) {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(arr)); } catch (_) {}
}

function renderSavedList() {
  const list = el('savedList');
  const items = loadSaved();
  el('savedEmpty').hidden = items.length !== 0;
  list.innerHTML = '';
  items.forEach((it, i) => {
    const sub = describeQuery(it.query);
    const row = document.createElement('div');
    row.className = 'saved-item';
    row.innerHTML = `<button type="button" class="saved-apply">
        <span class="saved-item-name"></span>
        ${sub ? '<span class="saved-item-sub"></span>' : ''}
      </button>
      <button type="button" class="saved-del" aria-label="delete">×</button>`;
    row.querySelector('.saved-item-name').textContent = it.name;
    if (sub) row.querySelector('.saved-item-sub').textContent = sub;
    row.querySelector('.saved-apply').addEventListener('click', () => {
      applyFilterQuery(it.query);
      el('saved').classList.remove('open');
    });
    row.querySelector('.saved-del').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!window.confirm(t('savedDelConfirm'))) return;
      const arr = loadSaved(); arr.splice(i, 1); storeSaved(arr);
      renderSavedList(); updateSavedControls();
    });
    list.appendChild(row);
  });
}

function updateSavedControls() {
  const n = loadSaved().length;
  const note = el('savedNote');
  const add = el('savedAdd');
  if (n >= SAVED_MAX) {
    note.hidden = false; note.textContent = t('savedMax'); note.classList.add('warn');
    add.disabled = true;
  } else {
    note.hidden = true; note.classList.remove('warn');
    add.disabled = false;
  }
}

function setupSaved() {
  const savedEl = el('saved');
  const nameInput = el('savedName');

  el('savedBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    const opening = !savedEl.classList.contains('open');
    savedEl.classList.toggle('open');
    el('savedBtn').setAttribute('aria-expanded', String(opening));
    if (opening) {
      // prefill a sensible default name from the current filters
      const desc = describeQuery(currentFilterQuery());
      nameInput.value = desc || `${t('savedDefault')} ${loadSaved().length + 1}`;
      renderSavedList();
      updateSavedControls();
      nameInput.focus(); nameInput.select();
    }
  });
  savedEl.querySelector('.saved-menu').addEventListener('click', (e) => e.stopPropagation());

  const doSave = () => {
    const query = currentFilterQuery();
    if (!query) { const nt = el('savedNote'); nt.hidden = false; nt.textContent = t('savedNoFilters'); nt.classList.remove('warn'); return; }
    const arr = loadSaved();
    if (arr.length >= SAVED_MAX) { updateSavedControls(); return; }
    const name = (nameInput.value.trim()) || `${t('savedDefault')} ${arr.length + 1}`;
    arr.push({ name, query });
    storeSaved(arr);
    renderSavedList(); updateSavedControls();
    nameInput.value = '';
  };
  el('savedAdd').addEventListener('click', doSave);
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSave(); });
}

// ---- Wire up ----
function bindEvents() {
  let tm;
  const debounced = () => { clearTimeout(tm); tm = setTimeout(applyFilters, 200); };
  controls.q.addEventListener('input', debounced);
  controls.qx.addEventListener('input', debounced);
  controls.minPrice.addEventListener('input', debounced);
  controls.maxPrice.addEventListener('input', debounced);
  ['condition', 'sort', 'dateFrom', 'dateTo'].forEach((k) => controls[k].addEventListener('change', applyFilters));
  controls.hasPrice.addEventListener('change', applyFilters);

  el('filtersToggle').addEventListener('click', () => {
    const open = el('filters').classList.toggle('open');
    el('filtersToggle').setAttribute('aria-expanded', String(open));
  });

  el('reset').addEventListener('click', () => {
    controls.q.value = '';
    controls.qx.value = '';
    controls.condition.value = '';
    controls.minPrice.value = '';
    controls.maxPrice.value = '';
    setDefaultDates(); // reset restores the default last-3-months range
    controls.sort.value = 'date_desc';
    controls.hasPrice.checked = false;
    ms.brand.clear(); ms.country.clear(); ms.source.clear();
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

async function loadActive() {
  showSkeletons();
  el('pagination').innerHTML = '';
  el('headerStatus').textContent = t('loading');
  const savedPage = page;
  try {
    ALL = await loadData(activeCat);
    buildFilters();
    restoreFromUrl();
    page = savedPage;
    el('headerStatus').textContent = '';
    updateTagline();
    applyFilters();
    if (savedPage > 1) { page = savedPage; render(); }
  } catch (err) {
    console.error(err);
    el('headerStatus').textContent = '';
    grid.innerHTML = `<div class="error-box">
      <strong>${escapeHtml(t('errTitle'))}</strong><br>${escapeHtml(err.message)}<br><br>${escapeHtml(t('errBody'))}
    </div>`;
    el('pagination').innerHTML = '';
  }
}

// ---- Shabbat observance (Hebcal, Jerusalem times) ----
// On Shabbat in Israel the site is unavailable. Times are compared as absolute
// instants (Hebcal returns Israel offsets), so it closes for every visitor
// worldwide during Israel's Shabbat. Fails OPEN if Hebcal can't be reached.
const HEBCAL_URL = 'https://www.hebcal.com/shabbat?cfg=json&geonameid=281184&b=40';

const CANDLES_SVG = `
<svg class="shabbat-svg" width="150" height="185" viewBox="0 0 150 185" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="sbWax" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbf3e0"/><stop offset="1" stop-color="#e7d5b0"/></linearGradient>
    <radialGradient id="sbFlame" cx="50%" cy="32%" r="70%"><stop offset="0" stop-color="#fff7cc"/><stop offset="45%" stop-color="#ffcf5c"/><stop offset="100%" stop-color="#ff8a00"/></radialGradient>
    <radialGradient id="sbHalo" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffcf7a" stop-opacity=".6"/><stop offset="100%" stop-color="#ffcf7a" stop-opacity="0"/></radialGradient>
  </defs>
  <circle cx="50" cy="56" r="24" fill="url(#sbHalo)"/>
  <circle cx="100" cy="56" r="24" fill="url(#sbHalo)"/>
  <ellipse cx="50" cy="162" rx="27" ry="7" fill="#c9a24b"/>
  <ellipse cx="100" cy="162" rx="27" ry="7" fill="#c9a24b"/>
  <rect x="45" y="152" width="10" height="12" rx="2" fill="#b8891f"/>
  <rect x="95" y="152" width="10" height="12" rx="2" fill="#b8891f"/>
  <rect x="42" y="80" width="16" height="74" rx="6" fill="url(#sbWax)" stroke="#dcc79a"/>
  <rect x="92" y="80" width="16" height="74" rx="6" fill="url(#sbWax)" stroke="#dcc79a"/>
  <rect x="49" y="74" width="2" height="8" fill="#5a4a2a"/>
  <rect x="99" y="74" width="2" height="8" fill="#5a4a2a"/>
  <path class="flame a" d="M50 42 C58 54 56 70 50 72 C44 70 42 54 50 42 Z" fill="url(#sbFlame)"/>
  <path class="flame b" d="M100 42 C108 54 106 70 100 72 C94 70 92 54 100 42 Z" fill="url(#sbFlame)"/>
</svg>`;

async function getShabbatWindow() {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(`${HEBCAL_URL}&_=${Date.now()}`, { cache: 'no-store', signal: ctrl.signal });
    if (!res.ok) throw new Error('hebcal ' + res.status);
    const data = await res.json();
    let candles = null, havdalah = null;
    for (const it of data.items || []) {
      if (it.category === 'candles' && !candles) candles = new Date(it.date);
      if (it.category === 'havdalah' && !havdalah) havdalah = new Date(it.date);
    }
    const now = new Date();
    const closed = !!(candles && havdalah && now >= candles && now < havdalah);
    return { candles, havdalah, closed };
  } finally {
    clearTimeout(to);
  }
}

function renderShabbatClosed() {
  document.documentElement.lang = 'he';
  document.documentElement.dir = 'rtl';
  document.title = 'שבת שלום';
  document.body.innerHTML = `
    <div class="shabbat-screen">
      <div class="shabbat-candles">${CANDLES_SVG}</div>
      <p class="shabbat-line1">אתר זה שומר שבת ויחזור לפעילות מיד בצאת השבת</p>
      <p class="shabbat-line2">שבת שלום</p>
    </div>`;
}

function applyStoredThemeEarly() {
  let saved = 'light';
  try { saved = localStorage.getItem(THEME_KEY) || 'light'; } catch (_) {}
  document.documentElement.setAttribute('data-theme', saved === 'dark' ? 'dark' : 'light');
}

// Reload at a future instant to flip open<->closed automatically (guards the
// setTimeout 32-bit range so far-off events just don't schedule).
function scheduleReload(when, padMs) {
  const ms = when.getTime() - Date.now() + (padMs || 0);
  if (ms > 0 && ms < 2147483647) setTimeout(() => location.reload(), ms);
}

async function boot() {
  applyStoredThemeEarly();
  try {
    const s = await getShabbatWindow();
    if (s.closed) {
      renderShabbatClosed();
      scheduleReload(s.havdalah, 5000); // reopen just after havdalah
      return;
    }
    if (s.candles) scheduleReload(s.candles, 2000); // auto-close when Shabbat starts
  } catch (err) {
    console.error('Shabbat check failed; opening site.', err); // fail open
  }
  init();
}

function init() {
  initTheme();
  setupMultiSelects();
  setupLang();
  setupSaved();
  bindEvents();

  const p = new URLSearchParams(location.search);
  // language: URL > stored > default he
  let startLang = 'he';
  try { startLang = localStorage.getItem(LANG_KEY) || 'he'; } catch (_) {}
  if (p.get('lang') && I18N[p.get('lang')]) startLang = p.get('lang');

  const wantedCat = CATEGORIES.find((c) => c.id === p.get('cat') && !c.comingSoon);
  if (wantedCat) activeCat = wantedCat;

  // Default to the last 3 months unless the URL explicitly carries a date range.
  if (!p.has('from') && !p.has('to')) setDefaultDates();

  setLanguage(startLang, { rerender: false }); // sets dir/lang/static text before data
  restoreFromUrl();
  loadActive();
}

boot();
