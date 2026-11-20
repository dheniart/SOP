/**
 * Lengkapi SOP - backend (Google Apps Script + Google Sheets)
 *
 * Menyimpan bank soal dan hasil kuis di Google Sheets milikmu supaya dibagikan
 * ke semua perangkat. Lihat PANDUAN-CLOUD.md untuk langkah pemasangan.
 *
 * Endpoint (web app):
 *   GET  ?action=questions                bank soal (publik, dibaca kuis)
 *   GET  ?action=results&token=...        hasil kuis (khusus trainer)
 *   GET  ?action=ping[&token=...]         uji koneksi / uji token
 *   POST {action:'submit', record}        kirim hasil kuis (publik)
 *   POST {action:'saveQuestions', token, bank}   simpan bank soal (trainer)
 *   POST {action:'clearResults', token}   hapus semua hasil (trainer)
 */

// GANTI nilai ini dengan token rahasia buatanmu (minimal 12 karakter, acak).
// Token ini dimasukkan di Dashboard > Pengaturan > Sinkronisasi cloud.
var ADMIN_TOKEN = 'GANTI-DENGAN-TOKEN-RAHASIA-ANDA';

var SH_Q = 'Pertanyaan', SH_R = 'Hasil', SH_M = 'Meta';
var Q_HEAD = ['id', 'topik', 'tipe', 'teks', 'opsi', 'jawabanBenar', 'penjelasan', 'aktif', 'dibuat', 'diubah'];
var R_HEAD = ['waktu', 'ts', 'nama', 'outlet', 'topik', 'poin', 'total', 'persen', 'lulus', 'jumlahSoal', 'salah', 'clientId'];

function tokenReady_() { return ADMIN_TOKEN.length >= 12 && ADMIN_TOKEN !== 'GANTI-DENGAN-TOKEN-RAHASIA-ANDA'; }
function authed_(t) { return tokenReady_() && String(t || '') === ADMIN_TOKEN; }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function sheet_(name, head) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(head); sh.setFrozenRows(1); }
  return sh;
}
// Cegah isi sel diperlakukan sebagai rumus di Google Sheets.
function safe_(v) { var s = String(v == null ? '' : v); return /^[=+\-@]/.test(s) ? "'" + s : s; }
function cut_(v, n) { return String(v == null ? '' : v).slice(0, n); }

function doGet(e) {
  var p = (e && e.parameter) || {}, a = p.action || 'questions';
  try {
    if (a === 'ping') return out_({ ok: true, configured: tokenReady_(), tokenOk: p.token ? authed_(p.token) : null });
    if (a === 'questions') return out_(readBank_());
    if (a === 'results') {
      if (!authed_(p.token)) return out_({ ok: false, error: 'unauthorized' });
      return out_({ ok: true, items: readResults_() });
    }
    return out_({ ok: false, error: 'aksi tidak dikenal' });
  } catch (err) { return out_({ ok: false, error: String(err) }); }
}

function doPost(e) {
  var b;
  try { b = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: 'JSON tidak valid' }); }
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    if (b.action === 'submit') return out_(submit_(b.record));
    if (b.action === 'saveQuestions') {
      if (!authed_(b.token)) return out_({ ok: false, error: 'unauthorized' });
      return out_(writeBank_(b.bank));
    }
    if (b.action === 'clearResults') {
      if (!authed_(b.token)) return out_({ ok: false, error: 'unauthorized' });
      var sh = sheet_(SH_R, R_HEAD), n = sh.getLastRow() - 1;
      if (n > 0) sh.deleteRows(2, n);
      return out_({ ok: true });
    }
    return out_({ ok: false, error: 'aksi tidak dikenal' });
  } catch (err) { return out_({ ok: false, error: String(err) }); }
  finally { try { lock.releaseLock(); } catch (x) { /* abaikan */ } }
}

/* ---------- bank soal ---------- */
function readBank_() {
  var q = sheet_(SH_Q, Q_HEAD), m = sheet_(SH_M, ['kunci', 'nilai']), items = [];
  var n = q.getLastRow() - 1;
  if (n > 0) {
    q.getRange(2, 1, n, Q_HEAD.length).getValues().forEach(function (r) {
      if (!r[0]) return;
      var opts = []; try { opts = JSON.parse(r[4] || '[]'); } catch (x) { opts = []; }
      items.push({ id: String(r[0]), topic: String(r[1]), type: r[2] === 'mcq' ? 'mcq' : 'cloze', text: String(r[3]), options: opts,
        correct: Number(r[5]) || 0, explanation: String(r[6] || ''), active: r[7] !== false && String(r[7]).toLowerCase() !== 'false',
        createdAt: String(r[8] || ''), updatedAt: String(r[9] || '') });
    });
  }
  var meta = {}, mn = m.getLastRow() - 1;
  if (mn > 0) m.getRange(2, 1, mn, 2).getValues().forEach(function (r) { meta[r[0]] = r[1]; });
  return { ok: true, version: Number(meta.version) || 1, updatedAt: String(meta.updatedAt || ''), items: items };
}

function writeBank_(bank) {
  if (!bank || !Array.isArray(bank.items)) return { ok: false, error: 'format bank soal salah' };
  if (bank.items.length > 3000) return { ok: false, error: 'terlalu banyak pertanyaan (maks 3000)' };
  var rows = bank.items.map(function (q) {
    return [cut_(q.id, 60), safe_(cut_(q.topic, 200)), q.type === 'mcq' ? 'mcq' : 'cloze', safe_(cut_(q.text, 3000)),
      JSON.stringify((q.options || []).slice(0, 8).map(function (o) { return cut_(o, 500); })), Number(q.correct) || 0,
      safe_(cut_(q.explanation, 2000)), q.active !== false, cut_(q.createdAt, 40), cut_(q.updatedAt, 40)];
  });
  var sh = sheet_(SH_Q, Q_HEAD), old = sh.getLastRow() - 1;
  if (old > 0) sh.deleteRows(2, old);
  if (rows.length) sh.getRange(2, 1, rows.length, Q_HEAD.length).setValues(rows);
  var m = sheet_(SH_M, ['kunci', 'nilai']), mo = m.getLastRow() - 1;
  if (mo > 0) m.deleteRows(2, mo);
  m.getRange(2, 1, 2, 2).setValues([['version', Number(bank.version) || 1], ['updatedAt', cut_(bank.updatedAt, 40) || new Date().toISOString()]]);
  return { ok: true, count: rows.length };
}

/* ---------- hasil kuis ---------- */
function submit_(r) {
  if (!r || typeof r !== 'object') return { ok: false, error: 'data kosong' };
  var nama = cut_(r.nama, 80).trim(), outlet = cut_(r.outlet, 80).trim();
  var poin = Number(r.points), total = Number(r.total);
  if (!nama || !outlet || !isFinite(poin) || !isFinite(total) || total <= 0 || poin < 0 || poin > total) return { ok: false, error: 'data hasil tidak valid' };
  var sh = sheet_(SH_R, R_HEAD), id = cut_(r.id, 40), n = sh.getLastRow() - 1;
  if (id && n > 0) {
    var ids = sh.getRange(2, R_HEAD.length, n, 1).getValues();
    for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === id) return { ok: true, duplicate: true };
  }
  var ts = Number(r.ts) || Date.now(), pct = Math.round(poin / total * 100);
  sh.appendRow([new Date(ts).toISOString(), ts, safe_(nama), safe_(outlet), safe_(cut_(r.topic, 200)), poin, total, pct,
    pct >= (Number(r.passScore) || 70), Number(r.count) || 0, cut_(JSON.stringify(r.wrong || []), 20000), id]);
  return { ok: true };
}

function readResults_() {
  var sh = sheet_(SH_R, R_HEAD), n = sh.getLastRow() - 1, out = [];
  if (n < 1) return out;
  sh.getRange(2, 1, n, R_HEAD.length).getValues().forEach(function (r, i) {
    var wrong = []; try { wrong = JSON.parse(r[10] || '[]'); } catch (x) { wrong = []; }
    out.push({ id: String(r[11] || 'r' + i), ts: Number(r[1]) || 0, nama: String(r[2]), outlet: String(r[3]), topic: String(r[4]),
      points: Number(r[5]), total: Number(r[6]), pct: Number(r[7]), pass: r[8] === true || String(r[8]).toLowerCase() === 'true',
      count: Number(r[9]) || 0, wrong: wrong });
  });
  out.sort(function (a, b) { return b.ts - a.ts; });
  return out;
}
