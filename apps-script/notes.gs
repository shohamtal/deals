/**
 * Deals site → "cars-notes" write endpoint (Google Apps Script web app).
 *
 * The deals site is read-only; this script is the only writer. It is bound to
 * the "web-automation" spreadsheet and runs as its owner, so it can write even
 * though the site's visitors can't. Every request must carry the password
 * stored in Script Properties (EDIT_PASSWORD) — it never appears in code.
 *
 * Setup (once): Extensions → Apps Script → paste this file → Project Settings →
 * Script Properties → add EDIT_PASSWORD → Deploy → New deployment → Web app,
 * Execute as: Me, Who has access: Anyone → copy the /exec URL into
 * NOTES_ENDPOINT in app.js.
 *
 * Request (POST, text/plain JSON to avoid a CORS preflight):
 *   { password, action: 'ping' }                         → { ok }
 *   { password, action: 'set', plate, field, value }     → { ok }
 */
const NOTES_TAB = 'cars-notes';
const ALLOWED = {
  exterior_color: ['white', 'black', 'silver', 'grey', 'blue', 'red', 'other', ''],
  seat_color: ['black', 'white', 'brown', 'other', ''],
};

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (_) { return json({ ok: false, error: 'bad json' }); }

  const expected = PropertiesService.getScriptProperties().getProperty('EDIT_PASSWORD');
  if (!expected || body.password !== expected) return json({ ok: false, error: 'bad password' });
  if (body.action === 'ping') return json({ ok: true });
  if (body.action !== 'set') return json({ ok: false, error: 'bad action' });

  const plate = String(body.plate || '').replace(/[^0-9A-Za-z]/g, '');
  const field = String(body.field || '');
  const value = String(body.value == null ? '' : body.value);
  if (!plate) return json({ ok: false, error: 'bad plate' });
  if (!ALLOWED[field] || ALLOWED[field].indexOf(value) < 0) return json({ ok: false, error: 'bad field/value' });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = SpreadsheetApp.getActive().getSheetByName(NOTES_TAB);
    const rows = sh.getDataRange().getValues();
    const head = rows[0].map(String);
    const col = head.indexOf(field);
    const updCol = head.indexOf('updated_at');
    let r = -1;
    for (let i = 1; i < rows.length; i++) if (String(rows[i][0]) === plate) { r = i; break; }
    if (r < 0) {
      sh.appendRow([plate]);
      r = sh.getLastRow() - 1;
      sh.getRange(r + 1, 1).setNumberFormat('@').setValue(plate); // keep leading zeros
    }
    sh.getRange(r + 1, col + 1).setValue(value);
    if (updCol >= 0) sh.getRange(r + 1, updCol + 1).setValue(new Date().toISOString());
  } finally {
    lock.releaseLock();
  }
  return json({ ok: true });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
