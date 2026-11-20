/* ==========================================================
   Lengkapi SOP - lapisan data (dipakai index.html dan admin.html)
   Semua data tersimpan di LocalStorage browser:
     lsop.questions  daftar pertanyaan (+ version, updatedAt)
     lsop.settings   pengaturan (outlet, jumlah soal, nilai lulus)
     lsop.history    riwayat pengerjaan di browser ini
     lsop.progress   progres kuis yang belum selesai
     ========================================================== */
(function (g) {
  'use strict';
  const K = { q: 'lsop.questions', s: 'lsop.settings', h: 'lsop.history', p: 'lsop.progress' };
  const DEFAULT_SETTINGS = {
    outlets: ['Kukusan UI', 'Dramaga', 'Unpam', 'UIN Jakarta', 'Kelapa Dua'],
    quizCount: 10,
    passScore: 70
  };

  const clone = o => JSON.parse(JSON.stringify(o));
  const read = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const now = () => new Date().toISOString();
  const listeners = [];
  function notify() { listeners.forEach(f => { try { f(); } catch (e) { /* diabaikan */ } }); }
  const uid = () => 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* ---------- pengacakan ---------- */
  function rnd(n) { try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; } catch (e) { return Math.floor(Math.random() * n); } }
  function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  /* ---------- teks rumpang ---------- */
  // Contoh: "Suhu chiller [[2-5]] derajat" -> bagian kosong dengan jawaban "2-5".
  // Alternatif jawaban dipisah garis tegak: [[golden brown|keemasan]]
  function parseCloze(text) {
    const parts = []; let last = 0, m; const re = /\[\[(.+?)\]\]/g;
    while ((m = re.exec(text))) {
      if (m.index > last) parts.push({ t: text.slice(last, m.index) });
      parts.push({ a: m[1].split('|').map(s => s.trim()).filter(Boolean) });
      last = re.lastIndex;
    }
    if (last < text.length) parts.push({ t: text.slice(last) });
    return parts;
  }
  const blanksOf = text => parseCloze(text).filter(p => p.a);

  /* ---------- pemeriksaan jawaban (toleran terhadap cara penulisan) ---------- */
  function norm(s) {
    s = String(s || '').toLowerCase().replace(/[’‘`]/g, "'").replace(/°/g, '');
    s = s.replace(/(\d)[.,](?=\d{3}(?!\d))/g, '$1');
    s = s.replace(/\s*(sampai dengan|sampai|s\/d|s\.d\.?|hingga|–|—)\s*/g, '-');
    s = s.replace(/\s*-\s*/g, '-');
    s = s.replace(/derajat\s*(celcius|celsius|c\b)?/g, 'c').replace(/cel[cs]ius/g, 'c');
    s = s.replace(/(\d)\s+(?=[a-z%])/g, '$1');
    s = s.replace(/(\d)(gram|gr|g)\b/g, '$1gram').replace(/(\d)(menit|mnt)\b/g, '$1menit').replace(/(\d)(detik|dtk)\b/g, '$1detik')
         .replace(/(\d)(kali|x)\b/g, '$1kali').replace(/(\d)(pcs|pc|potong|buah|biji)\b/g, '$1pcs');
    return s.replace(/\s+/g, ' ').trim();
  }
  function lev(a, b) {
    const m = a.length, n = b.length; if (Math.abs(m - n) > 1) return 2;
    const d = []; for (let i = 0; i <= m; i++) d[i] = [i]; for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }
  function checkAnswer(input, alts) {
    const x = norm(input); if (!x) return false;
    const c = [x]; const m = x.match(/^(\d[\d,.\-\/]*?)([a-z%]+)$/); if (m) c.push(m[1]);
    return alts.some(a => { const y = norm(a); return c.some(z => z === y || (/[a-z]/.test(y) && y.length >= 6 && lev(z, y) <= 1)); });
  }

  /* ---------- validasi pertanyaan ---------- */
  function validate(q) {
    const e = [];
    if (!String(q.topic || '').trim()) e.push('Topik SOP wajib diisi.');
    if (!String(q.text || '').trim()) e.push(q.type === 'cloze' ? 'Kalimat SOP wajib diisi.' : 'Pertanyaan wajib diisi.');
    if (q.type === 'cloze') {
      const b = blanksOf(q.text || '');
      if (!b.length) e.push('Tambahkan minimal satu bagian rumpang dengan format [[jawaban]].');
      if (/\[\[\s*\]\]/.test(q.text || '')) e.push('Ada rumpang [[ ]] yang masih kosong.');
    } else {
      const opts = (q.options || []).map(o => String(o).trim());
      if (opts.filter(Boolean).length < 2) e.push('Isi minimal 2 pilihan jawaban.');
      else if (!opts[q.correct]) e.push('Pilihan yang ditandai sebagai jawaban benar masih kosong.');
      else if (new Set(opts.filter(Boolean).map(o => o.toLowerCase())).size < opts.filter(Boolean).length) e.push('Ada pilihan jawaban yang sama.');
    }
    return e;
  }

  /* ---------- bank pertanyaan ---------- */
  function loadBank() {
    let b = read(K.q, null);
    if (!b || !Array.isArray(b.items)) { b = clone(g.SOP_SEED || { version: 1, updatedAt: now(), items: [] }); write(K.q, b); }
    return b;
  }
  function saveBank(b) { b.version = (b.version || 0) + 1; b.updatedAt = now(); const ok = write(K.q, b); notify(); return ok; }
  function clean(q) {
    const type = q.type === 'mcq' ? 'mcq' : 'cloze';
    const o = {
      topic: String(q.topic || '').trim(), type, text: String(q.text || '').trim(),
      options: type === 'mcq' ? (q.options || []).map(x => String(x).trim()).filter(Boolean) : [],
      correct: 0, explanation: String(q.explanation || '').trim(), active: q.active !== false
    };
    if (type === 'mcq') { const orig = (q.options || []).map(x => String(x).trim()); const right = orig[q.correct]; o.correct = Math.max(0, o.options.indexOf(right)); }
    return o;
  }

  const Store = {
    rnd, shuffle, parseCloze, blanksOf, checkAnswer, validate, norm,

    questions() { return loadBank().items; },
    bankInfo() { const b = loadBank(); return { version: b.version, updatedAt: b.updatedAt, count: b.items.length }; },
    topics() { return Array.from(new Set(loadBank().items.map(i => i.topic))).sort((a, b) => a.localeCompare(b, 'id')); },
    getQuestion(id) { return loadBank().items.find(i => i.id === id) || null; },

    addQuestion(q) {
      const errs = validate(q); if (errs.length) return { ok: false, errors: errs };
      const b = loadBank(); const t = now();
      const item = Object.assign({ id: uid(), createdAt: t, updatedAt: t }, clean(q));
      b.items.unshift(item); saveBank(b); return { ok: true, item };
    },
    updateQuestion(id, q) {
      const errs = validate(q); if (errs.length) return { ok: false, errors: errs };
      const b = loadBank(); const i = b.items.findIndex(x => x.id === id); if (i < 0) return { ok: false, errors: ['Pertanyaan tidak ditemukan.'] };
      b.items[i] = Object.assign({}, b.items[i], clean(q), { id, updatedAt: now() }); saveBank(b); return { ok: true, item: b.items[i] };
    },
    setActive(id, active) {
      const b = loadBank(); const it = b.items.find(x => x.id === id); if (!it) return false;
      it.active = !!active; it.updatedAt = now(); saveBank(b); return true;
    },
    deleteQuestion(id) {
      const b = loadBank(); const n = b.items.length; b.items = b.items.filter(x => x.id !== id);
      if (b.items.length === n) return false; saveBank(b); return true;
    },
    duplicateQuestion(id) {
      const b = loadBank(); const it = b.items.find(x => x.id === id); if (!it) return null;
      const t = now(); const copy = Object.assign(clone(it), { id: uid(), createdAt: t, updatedAt: t });
      b.items.unshift(copy); saveBank(b); return copy;
    },

    /* ---------- impor / ekspor / reset ---------- */
    exportBank() { return JSON.stringify(loadBank(), null, 1); },
    importBank(text, mode) {
      let d; try { d = JSON.parse(text); } catch (e) { return { ok: false, error: 'File bukan JSON yang valid.' }; }
      const items = Array.isArray(d) ? d : d && d.items;
      if (!Array.isArray(items)) return { ok: false, error: 'Format tidak dikenali: daftar pertanyaan tidak ditemukan.' };
      const good = [], skipped = [];
      items.forEach((q, i) => {
        const o = Object.assign({}, q, { type: q.type === 'mcq' ? 'mcq' : 'cloze' });
        if (validate(o).length) { skipped.push(i + 1); return; }
        const t = now();
        good.push(Object.assign({ id: q.id || uid(), createdAt: q.createdAt || t, updatedAt: q.updatedAt || t }, clean(o)));
      });
      if (!good.length) return { ok: false, error: 'Tidak ada pertanyaan valid di dalam file.' };
      const b = loadBank(); let added = 0, updated = 0;
      if (mode === 'replace') { b.items = good; added = good.length; }
      else good.forEach(q => { const i = b.items.findIndex(x => x.id === q.id); if (i >= 0) { b.items[i] = q; updated++; } else { b.items.push(q); added++; } });
      saveBank(b); return { ok: true, added, updated, skipped: skipped.length };
    },
    resetBank() { const b = clone(g.SOP_SEED); b.version = (loadBank().version || 0) + 1; b.updatedAt = now(); const ok = write(K.q, b); notify(); return ok; },
    onChange(fn) { listeners.push(fn); },
    bankRaw() { return clone(loadBank()); },
    /* Pakai bank dari cloud/berkas tanpa memicu sinkron balik. */
    applyRemote(b) { return write(K.q, b); },

    /* Ambil questions.json dari server (jika ada) dan pakai bila versinya lebih baru. */
    async syncRemote(url) {
      try {
        const r = await fetch((url || 'data/questions.json') + '?t=' + Date.now(), { cache: 'no-store' });
        if (!r.ok) return { ok: false };
        const d = await r.json();
        if (!d || !Array.isArray(d.items) || !d.items.length) return { ok: false };
        const local = loadBank();
        if (String(d.updatedAt || '') > String(local.updatedAt || '')) { write(K.q, d); return { ok: true, updated: true, version: d.version }; }
        return { ok: true, updated: false };
      } catch (e) { return { ok: false }; }
    },

    /* ---------- pengaturan ---------- */
    settings() { return Object.assign({}, DEFAULT_SETTINGS, read(K.s, {})); },
    saveSettings(s) { return write(K.s, Object.assign(this.settings(), s)); },

    /* ---------- riwayat & progres ---------- */
    history() { return read(K.h, []); },
    addHistory(rec) { const l = read(K.h, []); l.unshift(rec); return write(K.h, l.slice(0, 500)); },
    clearHistory() { try { localStorage.removeItem(K.h); } catch (e) { /* diabaikan */ } },
    progress() { return read(K.p, null); },
    saveProgress(p) { return write(K.p, p); },
    clearProgress() { try { localStorage.removeItem(K.p); } catch (e) { /* diabaikan */ } }
  };

  g.SOPStore = Store;
})(window);
