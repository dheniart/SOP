/* ==========================================================
   Lengkapi SOP - klien cloud (Google Apps Script + Google Sheets)
   Tanpa konfigurasi, semua fungsi mengembalikan {ok:false} dan aplikasi
   tetap berjalan dengan LocalStorage saja.
   ========================================================== */
(function (g) {
  'use strict';
  const UK = 'lsop.cloud.url', TK = 'lsop.cloud.token', OB = 'lsop.outbox';
  const lsGet = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const lsSet = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { /* diabaikan */ } };
  const url = () => lsGet(UK) || ((g.SOP_CLOUD && g.SOP_CLOUD.url) || '');

  async function req(method, params, body, urlOverride) {
    const u = urlOverride || url();
    if (!u) return { ok: false, error: 'Cloud belum dikonfigurasi' };
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 20000);
    try {
      let r;
      if (method === 'GET') {
        const q = Object.keys(params).map(k => k + '=' + encodeURIComponent(params[k])).join('&');
        r = await fetch(u + (u.indexOf('?') >= 0 ? '&' : '?') + q + '&_t=' + Date.now(), { signal: ctl.signal });
      } else {
        r = await fetch(u, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), signal: ctl.signal });
      }
      const d = await r.json();
      return d && typeof d === 'object' ? d : { ok: false, error: 'Respons tidak valid' };
    } catch (e) {
      return { ok: false, error: e && e.name === 'AbortError' ? 'Waktu habis, coba lagi' : 'Tidak bisa terhubung ke cloud' };
    } finally { clearTimeout(timer); }
  }

  const Cloud = {
    enabled() { return !!url(); },
    url,
    token() { return lsGet(TK); },
    setToken(t) { lsSet(TK, String(t || '').trim()); },
    setUrl(u) { lsSet(UK, String(u || '').trim()); },
    configText(u) { return '/* Alamat backend cloud (Google Apps Script). */\nwindow.SOP_CLOUD = { url: ' + JSON.stringify(String(u || '').trim()) + ' };\n'; },

    async pull() {
      const d = await req('GET', { action: 'questions' });
      if (d.ok && Array.isArray(d.items) && d.items.length) return { ok: true, bank: { version: d.version || 1, updatedAt: d.updatedAt || '', items: d.items } };
      return { ok: false, error: d.error || 'Bank soal di cloud masih kosong' };
    },
    push(bank, token) { return req('POST', {}, { action: 'saveQuestions', token: token, bank: bank }); },
    async results(token) {
      const d = await req('GET', { action: 'results', token: token });
      return d.ok && Array.isArray(d.items) ? { ok: true, items: d.items } : { ok: false, error: d.error === 'unauthorized' ? 'Token salah' : (d.error || 'Gagal memuat hasil') };
    },
    clearResults(token) { return req('POST', {}, { action: 'clearResults', token: token }); },
    ping(token, urlOverride) { return req('GET', { action: 'ping', token: token || '' }, null, urlOverride); },

    /* Kirim hasil kuis; jika gagal, simpan di antrean dan coba lagi nanti. */
    async submit(rec) {
      if (!url()) return 'off';
      const r = await req('POST', {}, { action: 'submit', record: rec });
      if (r.ok) return 'sent';
      const q = Cloud.outbox(); q.push(rec); try { localStorage.setItem(OB, JSON.stringify(q.slice(-50))); } catch (e) { /* diabaikan */ }
      return 'queued';
    },
    outbox() { try { return JSON.parse(localStorage.getItem(OB) || '[]'); } catch (e) { return []; } },
    async flush() {
      if (!url()) return 0;
      const q = Cloud.outbox(); let sent = 0;
      while (q.length) {
        const r = await req('POST', {}, { action: 'submit', record: q[0] });
        if (!r.ok) break; q.shift(); sent++;
        try { localStorage.setItem(OB, JSON.stringify(q)); } catch (e) { break; }
      }
      return sent;
    }
  };
  g.SOPCloud = Cloud;
})(window);
