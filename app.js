/* Deals — frontend-only, read-only.
 * Reads public Google Sheet tabs via the gviz endpoint (plain GET, no auth,
 * no API key, no write scope). Nothing here can modify the sheet.
 *
 * Adding a new deal category later = add an entry to CATEGORIES below.
 * Each category maps to one sheet tab and its column layout. */

'use strict';

// ---- Categories (tabs) ----
const CATEGORIES = [
  {
    id: 'watches',
    label: '⌚ Watches',
    sheetId: '1jbke0dmA01rr-eTtHJ7GHZK4ULVIXi3dlR1P9k5BUWc',
    gid: '0', // "watches" tab
    columns: {
      timestamp: 0, source: 1, country: 2, brand: 3, model: 4,
      price_usd: 5, price_nis: 6, url: 10, image_url: 11,
      description: 12, condition: 13,
    },
  },
  // Example of a future tab — flip `comingSoon` off and fill in sheet/columns:
  { id: 'cars', label: '🚗 Cars', comingSoon: true },
];

const PAGE_SIZE = 50;
const THEME_KEY = 'deals-theme';

// ---- State ----
let activeCat = CATEGORIES[0];
let ALL = [];
let VIEW = [];
let page = 1;

// ---- DOM ----
const el = (id) => document.getElementById(id);
const grid = el('grid');
const controls = {
  q: el('q'), condition: el('condition'),
  minPrice: el('minPrice'), maxPrice: el('maxPrice'),
  sort: el('sort'), hasPrice: el('hasPriceChk'),
};
const ms = {}; // multi-select filters: brand, country, source

// ---- Theme (light is default) ----
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem(THEME_KEY, theme); } catch (_) {}
  el('themeToggle').textContent = theme === 'dark' ? '☀️' : '🌙';
}
function initTheme() {
  let saved = 'light';
  try { saved = localStorage.getItem(THEME_KEY) || 'light'; } catch (_) {}
  applyTheme(saved === 'dark' ? 'dark' : 'light'); // default light
  el('themeToggle').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  });
}

// ---- Helpers ----
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

// ---- Multi-select dropdown (checkboxes + search) ----
function createMultiSelect(mount, { allLabel, onChange }) {
  const selected = new Set();
  let options = []; // [{value, count}]

  mount.innerHTML = `
    <button type="button" class="ms-trigger">${escapeHtml(allLabel)}</button>
    <div class="ms-panel" role="listbox" aria-multiselectable="true">
      <input type="text" class="ms-search" placeholder="Filter…" autocomplete="off" />
      <div class="ms-list"></div>
      <div class="ms-empty" hidden>No matches</div>
      <div class="ms-foot"><button type="button" class="ms-clear">Clear</button></div>
    </div>`;
  const trigger = mount.querySelector('.ms-trigger');
  const panel = mount.querySelector('.ms-panel');
  const search = mount.querySelector('.ms-search');
  const list = mount.querySelector('.ms-list');
  const empty = mount.querySelector('.ms-empty');
  const clearBtn = mount.querySelector('.ms-clear');

  function updateTrigger() {
    const n = selected.size;
    if (n === 0) { trigger.textContent = allLabel; trigger.classList.remove('has-sel'); }
    else if (n === 1) { trigger.textContent = [...selected][0]; trigger.classList.add('has-sel'); }
    else { trigger.textContent = `${n} selected`; trigger.classList.add('has-sel'); }
  }

  function renderList() {
    const q = search.value.trim().toLowerCase();
    list.innerHTML = '';
    let shown = 0;
    options.forEach((opt) => {
      if (q && !opt.value.toLowerCase().includes(q)) return;
      shown++;
      const id = 'ms-' + Math.random().toString(36).slice(2, 9);
      const row = document.createElement('label');
      row.className = 'ms-option';
      row.htmlFor = id;
      row.innerHTML = `<input type="checkbox" id="${id}"${selected.has(opt.value) ? ' checked' : ''} />
        <span class="ms-label"></span><span class="ms-count">${opt.count}</span>`;
      row.querySelector('.ms-label').textContent = opt.value;
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

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    mount.classList.contains('open') ? close() : open();
  });
  search.addEventListener('input', renderList);
  search.addEventListener('click', (e) => e.stopPropagation());
  panel.addEventListener('click', (e) => e.stopPropagation());
  clearBtn.addEventListener('click', () => { selected.clear(); updateTrigger(); renderList(); onChange(); });
  mount.addEventListener('keydown', (e) => { if (e.key === 'Escape') { close(); trigger.focus(); } });

  return {
    setOptions(items) { options = items; renderList(); },
    getSelected() { return [...selected]; },
    setSelected(arr) { selected.clear(); (arr || []).forEach((v) => selected.add(v)); updateTrigger(); renderList(); },
    clear() { selected.clear(); updateTrigger(); renderList(); },
  };
}

function setupMultiSelects() {
  const apply = () => applyFilters();
  document.querySelectorAll('.ms[data-ms]').forEach((mount) => {
    ms[mount.dataset.ms] = createMultiSelect(mount, { allLabel: mount.dataset.all || 'All', onChange: apply });
  });
  // Close any open panel when clicking elsewhere.
  document.addEventListener('click', () => {
    document.querySelectorAll('.ms.open').forEach((m) => m.classList.remove('open'));
  });
}

// ---- Fetch & parse gviz (LIVE, never cached) ----
async function loadData(cat) {
  const base = `https://docs.google.com/spreadsheets/d/${cat.sheetId}/gviz/tq?tqx=out:json&gid=${cat.gid}`;
  // cache: 'no-store' + a cache-buster param guarantee fresh rows on every load.
  const url = `${base}&_=${Date.now()}`;
  const res = await fetch(url, { method: 'GET', cache: 'no-store' });
  if (!res.ok) throw new Error(`Sheet request failed (HTTP ${res.status})`);
  const text = await res.text();
  const json = JSON.parse(text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1));
  const rows = json.table.rows || [];
  const C = cat.columns;

  const cell = (r, i) => {
    const c = r.c && r.c[i];
    return c && c.v !== null && c.v !== undefined ? c.v : '';
  };

  const list = [];
  for (const r of rows) {
    const ts = String(cell(r, C.timestamp)).trim();
    if (!ts || ts.toLowerCase() === 'timestamp') continue; // skip header / blanks
    const url2 = String(cell(r, C.url)).trim();
    if (!url2) continue;
    list.push({
      timestamp: ts,
      time: Date.parse(ts) || 0,
      source: String(cell(r, C.source)).trim(),
      country: String(cell(r, C.country)).trim(),
      brand: String(cell(r, C.brand)).trim() || 'Unknown',
      model: String(cell(r, C.model)).trim(),
      priceUsd: parsePrice(cell(r, C.price_usd)),
      priceNis: parsePrice(cell(r, C.price_nis)),
      url: url2,
      image: String(cell(r, C.image_url)).trim(),
      description: String(cell(r, C.description)).trim(),
      condition: String(cell(r, C.condition)).trim(),
    });
  }
  return list;
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
    b.innerHTML = escapeHtml(cat.label) + (cat.comingSoon ? '<span class="soon">soon</span>' : '');
    if (!cat.comingSoon) {
      b.addEventListener('click', () => { if (cat.id !== activeCat.id) switchCategory(cat); });
    }
    nav.appendChild(b);
  });
}

async function switchCategory(cat) {
  activeCat = cat;
  page = 1;
  ['q', 'condition', 'minPrice', 'maxPrice'].forEach((k) => { if (controls[k]) controls[k].value = ''; });
  controls.sort.value = 'date_desc';
  controls.hasPrice.checked = false;
  ['brand', 'country', 'source'].forEach((k) => ms[k] && ms[k].clear());
  renderTabs();
  el('catLabel').textContent = cat.label;
  await loadActive();
}

// ---- Filter dropdown population ----
function fillSelect(select, values) {
  const first = select.querySelector('option');
  select.innerHTML = '';
  if (first) select.appendChild(first);
  values.forEach((v) => {
    const o = document.createElement('option');
    o.value = v; o.textContent = v;
    select.appendChild(o);
  });
}

function buildFilters() {
  // value -> count, sorted by count desc then name, for each key.
  const counted = (key) => {
    const m = new Map();
    ALL.forEach((x) => { const v = x[key]; if (v) m.set(v, (m.get(v) || 0) + 1); });
    return [...m.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  };
  ms.brand.setOptions(counted('brand'));
  ms.country.setOptions(counted('country'));
  ms.source.setOptions(counted('source'));

  const uniq = (key) => [...new Set(ALL.map((x) => x[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  fillSelect(controls.condition, uniq('condition'));
}

// ---- Filtering + sorting ----
function applyFilters() {
  const q = controls.q.value.trim().toLowerCase();
  const brandSet = new Set(ms.brand.getSelected());
  const countrySet = new Set(ms.country.getSelected());
  const sourceSet = new Set(ms.source.getSelected());
  const condition = controls.condition.value;
  const min = parsePrice(controls.minPrice.value);
  const max = parsePrice(controls.maxPrice.value);
  const onlyPriced = controls.hasPrice.checked;

  VIEW = ALL.filter((w) => {
    if (brandSet.size && !brandSet.has(w.brand)) return false;
    if (countrySet.size && !countrySet.has(w.country)) return false;
    if (sourceSet.size && !sourceSet.has(w.source)) return false;
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
    ? `Showing ${start + 1}–${start + slice.length} of ${total.toLocaleString()} listings`
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
  if (activeCat.id !== CATEGORIES[0].id) p.set('cat', activeCat.id);
  if (controls.q.value.trim()) p.set('q', controls.q.value.trim());
  ms.brand.getSelected().forEach((v) => p.append('brand', v));
  ms.country.getSelected().forEach((v) => p.append('country', v));
  ms.source.getSelected().forEach((v) => p.append('source', v));
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
  const set = (ctrl, key) => { if (ctrl && p.has(key)) ctrl.value = p.get(key); };
  set(controls.q, 'q');
  if (p.has('brand')) ms.brand.setSelected(p.getAll('brand'));
  if (p.has('country')) ms.country.setSelected(p.getAll('country'));
  if (p.has('source')) ms.source.setSelected(p.getAll('source'));
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
  ['condition', 'sort'].forEach((k) => controls[k].addEventListener('change', applyFilters));
  controls.hasPrice.addEventListener('change', applyFilters);

  el('reset').addEventListener('click', () => {
    controls.q.value = '';
    controls.condition.value = '';
    controls.minPrice.value = '';
    controls.maxPrice.value = '';
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
  el('headerStatus').textContent = 'Loading live data…';
  const savedPage = page;
  try {
    ALL = await loadData(activeCat);
    buildFilters();
    restoreFromUrl(); // re-apply once dropdown options exist
    page = savedPage;
    el('totalCount').textContent = ALL.length.toLocaleString();
    el('headerStatus').textContent = '';
    applyFilters();
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

function init() {
  initTheme();
  setupMultiSelects();
  bindEvents();

  // Pick active category from URL (?cat=), default to the first real tab.
  const p = new URLSearchParams(location.search);
  const wanted = CATEGORIES.find((c) => c.id === p.get('cat') && !c.comingSoon);
  if (wanted) activeCat = wanted;

  renderTabs();
  el('catLabel').textContent = activeCat.label;
  restoreFromUrl();
  loadActive();
}

init();
