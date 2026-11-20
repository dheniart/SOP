/* ==========================================================
   Lengkapi SOP - antarmuka kuis peserta
   ========================================================== */
(function () {
  'use strict';
  const S = window.SOPStore, UI = window.UI, esc = UI.esc;
  const $ = id => document.getElementById(id);
  let st = null; // state kuis

  const screens = ['screen-start', 'screen-quiz', 'screen-result'];
  function show(id) { screens.forEach(s => $(s).classList.toggle('hidden', s !== id)); window.scrollTo(0, 0); }

  /* ---------------- layar mulai ---------------- */
  function activeQs() { return S.questions().filter(q => q.active !== false); }

  function fillStart() {
    const set = S.settings();
    $('f-outlet').innerHTML = '<option value="" disabled selected>Pilih outlet</option>' + set.outlets.map(o => '<option>' + esc(o) + '</option>').join('');
    const act = activeQs(), byTopic = {};
    act.forEach(q => { byTopic[q.topic] = (byTopic[q.topic] || 0) + 1; });
    $('f-topic').innerHTML = '<option value="">Semua topik (acak)</option>' +
      Object.keys(byTopic).sort((a, b) => a.localeCompare(b, 'id')).map(t => '<option value="' + esc(t) + '">' + esc(t) + ' (' + byTopic[t] + ')</option>').join('');
    const counts = [5, 10, 15, 20, 30]; if (!counts.includes(set.quizCount)) counts.push(set.quizCount); counts.sort((a, b) => a - b);
    $('f-count').innerHTML = counts.map(n => '<option value="' + n + '"' + (n === set.quizCount ? ' selected' : '') + '>' + n + ' soal</option>').join('');
    const info = S.bankInfo();
    $('bank-info').textContent = 'Bank soal v' + info.version + ' · ' + act.length + ' pertanyaan aktif · diperbarui ' + UI.fmtDate(info.updatedAt);
    updateAvail(); validateStart();
  }
  function poolFor() { const t = $('f-topic').value; return activeQs().filter(q => !t || q.topic === t); }
  function updateAvail() {
    const n = poolFor().length;
    $('avail').textContent = n ? n + ' pertanyaan tersedia untuk pilihanmu.' : 'Belum ada pertanyaan aktif untuk topik ini. Hubungi trainer.';
  }
  function validateStart() { $('btn-start').disabled = !($('f-nama').value.trim() && $('f-outlet').value && poolFor().length); }
  ['f-nama', 'f-outlet', 'f-topic', 'f-count'].forEach(id => $(id).addEventListener(id === 'f-nama' ? 'input' : 'change', () => { updateAvail(); validateStart(); }));
  $('f-nama').addEventListener('input', validateStart);

  function showResume() {
    const p = S.progress(), box = $('resume-box');
    if (!p || !p.items || !p.items.length) { box.classList.add('hidden'); return; }
    $('resume-text').textContent = p.nama + ' · soal ' + (p.idx + 1) + ' dari ' + p.items.length + '. Progresmu tersimpan di browser ini.';
    box.classList.remove('hidden');
  }
  $('btn-resume').addEventListener('click', () => { st = S.progress(); if (st) { show('screen-quiz'); renderQuestion(); } });
  $('btn-discard').addEventListener('click', () => { S.clearProgress(); showResume(); });

  $('start-form').addEventListener('submit', e => {
    e.preventDefault();
    const pool = poolFor(); if (!pool.length) { UI.toast('Belum ada pertanyaan untuk pilihan ini.', 'err'); return; }
    const n = Math.min(parseInt($('f-count').value, 10) || 10, pool.length);
    const items = S.shuffle(pool).slice(0, n).map(q => ({
      id: q.id, topic: q.topic, type: q.type, text: q.text, options: q.options || [], correct: q.correct, explanation: q.explanation || '',
      order: q.type === 'mcq' ? S.shuffle(q.options.map((_, i) => i)) : []
    }));
    st = { nama: $('f-nama').value.trim(), outlet: $('f-outlet').value, topic: $('f-topic').value, items, idx: 0, points: 0, total: 0, answers: [], draft: [], sel: null, startedAt: Date.now() };
    S.saveProgress(st); show('screen-quiz'); renderQuestion();
  });

  /* ---------------- pengerjaan ---------------- */
  const cur = () => st.items[st.idx];
  const reviewing = () => !!st.answers[st.idx];

  function renderQuestion() {
    const q = cur(), a = st.answers[st.idx], total = st.items.length;
    $('q-count').textContent = 'Soal ' + (st.idx + 1) + ' dari ' + total;
    $('q-score').textContent = 'Skor ' + st.points + '/' + st.total + ' poin';
    const pct = Math.round((st.idx + (a ? 1 : 0)) / total * 100);
    $('q-progress').style.width = pct + '%'; $('q-progress-wrap').setAttribute('aria-valuenow', pct);
    $('q-topic').textContent = q.topic;
    $('q-hint').textContent = q.type === 'cloze' ? 'Lengkapi bagian yang kosong. Tulis angkanya saja jika satuannya sudah ada di kalimat.' : 'Pilih satu jawaban yang paling tepat.';
    $('q-body').innerHTML = q.type === 'cloze' ? clozeHtml(q, a) : mcqHtml(q, a);
    const fb = $('q-feedback');
    if (a) { fb.innerHTML = feedbackHtml(q, a); fb.classList.remove('hidden'); } else { fb.classList.add('hidden'); fb.innerHTML = ''; }
    $('btn-check').classList.toggle('hidden', !!a);
    $('btn-next').classList.toggle('hidden', !a);
    $('btn-next').textContent = st.idx === total - 1 ? 'Lihat hasil' : 'Lanjut';
    const first = $('q-body').querySelector('input'); if (first && !a) first.focus();
  }

  function clozeHtml(q, a) {
    let bi = 0;
    return '<p class="text-lg leading-10 text-slate-900">' + S.parseCloze(q.text).map(p => {
      if (p.t !== undefined) return esc(p.t);
      const i = bi++;
      if (a) {
        const d = a.detail[i];
        return d.ok ? '<span class="mx-1 rounded-md bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">' + esc(d.u) + '</span>'
          : '<span class="mx-1 rounded-md bg-rose-100 px-2 py-0.5 font-semibold text-rose-800 line-through">' + esc(d.u || 'kosong') + '</span><span class="mx-1 rounded-md bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">' + esc(d.a) + '</span>';
      }
      const w = Math.min(16, Math.max(5, Math.max.apply(null, p.a.map(x => x.length)) + 2));
      return '<input data-b="' + i + '" type="text" value="' + esc(st.draft[i] || '') + '" style="width:' + w + 'ch" aria-label="Isian ' + (i + 1) + '" autocomplete="off" autocapitalize="off" spellcheck="false" class="mx-1 inline-block rounded-md border-0 bg-indigo-50 px-2 py-1 text-center text-base font-semibold text-indigo-900 ring-1 ring-inset ring-indigo-200 focus:ring-2 focus:ring-indigo-600">';
    }).join('') + '</p>';
  }

  function mcqHtml(q, a) {
    const letters = 'ABCDEF';
    return '<p class="text-lg font-medium text-slate-900">' + esc(q.text) + '</p><div class="mt-4 space-y-2" role="radiogroup">' + q.order.map((oi, pos) => {
      let cls = 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50';
      if (a) { if (oi === q.correct) cls = 'border-emerald-500 bg-emerald-50'; else if (pos === a.sel) cls = 'border-rose-500 bg-rose-50'; else cls = 'border-slate-200 bg-white opacity-70'; }
      else if (st.sel === pos) cls = 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600';
      return '<button type="button" data-pos="' + pos + '" role="radio" aria-checked="' + (st.sel === pos) + '" ' + (a ? 'disabled' : '') + ' class="flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ' + cls + '"><span class="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">' + letters[pos] + '</span><span class="pt-0.5">' + esc(q.options[oi]) + '</span></button>';
    }).join('') + '</div>';
  }

  function feedbackHtml(q, a) {
    const full = a.pts === a.max, none = a.pts === 0;
    const tone = full ? ['bg-emerald-50 text-emerald-800 ring-emerald-200', 'Benar semua'] : none ? ['bg-rose-50 text-rose-800 ring-rose-200', 'Belum tepat'] : ['bg-amber-50 text-amber-800 ring-amber-200', 'Sebagian benar'];
    return '<div class="rounded-xl p-4 text-sm ring-1 ring-inset ' + tone[0] + '"><p class="font-semibold">' + tone[1] + ' · ' + a.pts + ' dari ' + a.max + ' poin</p>' +
      (q.explanation ? '<p class="mt-1 text-slate-700">' + esc(q.explanation) + '</p>' : '') + '</div>';
  }

  /* input dan pilihan */
  $('q-body').addEventListener('input', e => {
    const i = e.target.dataset.b; if (i === undefined) return;
    st.draft[Number(i)] = e.target.value; S.saveProgress(st);
  });
  $('q-body').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('btn-check').click(); } });
  $('q-body').addEventListener('click', e => {
    const b = e.target.closest('[data-pos]'); if (!b || reviewing()) return;
    st.sel = Number(b.dataset.pos); S.saveProgress(st); renderQuestion();
  });

  /* periksa */
  $('btn-check').addEventListener('click', () => {
    if (reviewing()) return;
    const q = cur(); let ans;
    if (q.type === 'cloze') {
      const bl = S.blanksOf(q.text);
      if (!bl.some((_, i) => (st.draft[i] || '').trim())) { UI.toast('Isi minimal satu bagian yang kosong.', 'err'); return; }
      const detail = bl.map((b, i) => { const u = (st.draft[i] || '').trim(); return { u: u, a: b.a[0], ok: S.checkAnswer(u, b.a) }; });
      ans = { pts: detail.filter(d => d.ok).length, max: bl.length, detail: detail };
    } else {
      if (st.sel === null) { UI.toast('Pilih satu jawaban dulu.', 'err'); return; }
      const ok = q.order[st.sel] === q.correct;
      ans = { pts: ok ? 1 : 0, max: 1, sel: st.sel, detail: [] };
    }
    st.answers[st.idx] = ans; st.points += ans.pts; st.total += ans.max;
    S.saveProgress(st); renderQuestion();
    $('btn-next').focus();
  });

  $('btn-next').addEventListener('click', () => {
    if (st.idx < st.items.length - 1) { st.idx++; st.draft = []; st.sel = null; S.saveProgress(st); renderQuestion(); window.scrollTo(0, 0); }
    else finish();
  });

  $('btn-exit').addEventListener('click', () => confirmBox('Keluar dari kuis?', 'Progresmu tetap tersimpan di browser ini dan bisa dilanjutkan dari halaman awal.', 'Keluar', () => { showResume(); fillStart(); show('screen-start'); }));

  /* ---------------- hasil ---------------- */
  function finish() {
    const set = S.settings(), pct = st.total ? Math.round(st.points / st.total * 100) : 0, pass = pct >= set.passScore;
    const wrong = [];
    st.items.forEach((q, i) => {
      const a = st.answers[i]; if (!a || a.pts === a.max) return;
      if (q.type === 'cloze') wrong.push({ text: q.text.replace(/\[\[(.+?)\]\]/g, '___'), detail: a.detail.filter(d => !d.ok), topic: q.topic });
      else wrong.push({ text: q.text, topic: q.topic, mcq: true, a: q.options[q.correct], u: q.options[q.order[a.sel]] });
    });
    const rec = { id: 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), nama: st.nama, outlet: st.outlet, topic: st.topic || 'Semua topik', count: st.items.length, points: st.points, total: st.total, pct: pct, pass: pass, passScore: set.passScore, ts: Date.now(), wrong: wrong };
    S.addHistory(rec);
    const sy = $('r-sync');
    if (window.SOPCloud && SOPCloud.enabled()) {
      sy.textContent = 'Mengirim hasil ke trainer...';
      SOPCloud.submit(rec).then(r => { sy.textContent = r === 'sent' ? 'Hasil sudah terkirim ke trainer.' : 'Hasil belum terkirim (tidak ada koneksi). Akan dicoba lagi otomatis saat kuis dibuka berikutnya.'; });
    } else { sy.textContent = 'Hasil tersimpan di browser ini saja.'; }
    S.clearProgress();
    st.result = { pct: pct, pass: pass, wrong: wrong };
    $('r-who').textContent = st.nama + ' · ' + st.outlet;
    $('r-pct').textContent = pct + '%'; $('r-pts').textContent = st.points + ' dari ' + st.total + ' poin';
    const ring = $('r-ring'); ring.classList.toggle('stroke-emerald-500', pass); ring.classList.toggle('stroke-indigo-600', !pass);
    show('screen-result'); setTimeout(() => ring.setAttribute('stroke-dashoffset', String(339.29 * (1 - pct / 100))), 60);
    const b = $('r-badge'); b.textContent = pass ? 'Lulus' : 'Belum lulus';
    b.className = 'badge mt-4 ' + (pass ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700');
    $('r-msg').textContent = pass ? 'Kerja bagus! Pemahaman SOP kamu sudah baik.' : 'Pelajari lagi poin di bawah, lalu coba dengan soal baru. Nilai lulus: ' + set.passScore + '%.';
    const rv = $('r-review');
    if (wrong.length) {
      rv.classList.remove('hidden');
      rv.innerHTML = '<h2 class="text-base font-semibold text-slate-900">Yang perlu dipelajari</h2><ul class="mt-3 divide-y divide-slate-100">' + wrong.map(w =>
        '<li class="py-3 text-sm"><p class="text-xs font-medium text-slate-400">' + esc(w.topic) + '</p><p class="mt-0.5 text-slate-800">' + esc(w.text) + '</p>' +
        (w.mcq ? '<p class="mt-1 text-slate-500">Jawabanmu: <span class="font-medium text-rose-600">' + esc(w.u) + '</span> · Benar: <span class="font-medium text-emerald-600">' + esc(w.a) + '</span></p>'
          : '<p class="mt-1 text-slate-500">' + w.detail.map(d => '<span class="font-medium text-rose-600">' + esc(d.u || 'kosong') + '</span> → <span class="font-medium text-emerald-600">' + esc(d.a) + '</span>').join(' · ') + '</p>') + '</li>').join('') + '</ul>';
    } else { rv.classList.add('hidden'); rv.innerHTML = ''; }
  }

  $('btn-again').addEventListener('click', () => {
    const nama = st.nama, outlet = st.outlet, topic = st.topic, count = st.items.length;
    fillStart(); $('f-nama').value = nama; $('f-outlet').value = outlet; $('f-topic').value = topic; if ([...$('f-count').options].some(o => +o.value === count)) $('f-count').value = count;
    updateAvail(); validateStart(); $('start-form').requestSubmit ? $('start-form').requestSubmit() : $('btn-start').click();
  });
  $('btn-home').addEventListener('click', () => { $('f-nama').value = ''; showResume(); fillStart(); show('screen-start'); });
  $('btn-copy').addEventListener('click', async () => {
    const r = st.result; if (!r) return;
    let t = 'HASIL LENGKAPI SOP\nNama: ' + st.nama + '\nOutlet: ' + st.outlet + '\nTopik: ' + (st.topic || 'Semua topik') + '\nSkor: ' + r.pct + '% (' + st.points + '/' + st.total + ' poin) - ' + (r.pass ? 'Lulus' : 'Belum lulus') + '\n';
    if (r.wrong.length) t += '\nPerlu dipelajari:\n' + r.wrong.map(w => '- ' + w.text + ' | ' + (w.mcq ? 'jawaban: ' + w.u + ', benar: ' + w.a : w.detail.map(d => (d.u || 'kosong') + ' -> ' + d.a).join('; '))).join('\n');
    try { await navigator.clipboard.writeText(t); UI.toast('Hasil disalin.'); }
    catch (e) { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); UI.toast('Hasil disalin.'); } catch (_) { UI.toast('Tidak bisa menyalin otomatis.', 'err'); } ta.remove(); }
  });

  /* ---------------- dialog konfirmasi ---------------- */
  function confirmBox(title, text, okLabel, onOk) {
    const root = $('modal-root');
    root.innerHTML = '<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"><div class="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" role="dialog" aria-modal="true"><h2 class="text-base font-semibold text-slate-900">' + esc(title) + '</h2><p class="mt-1 text-sm text-slate-600">' + esc(text) + '</p><div class="mt-5 flex justify-end gap-2"><button id="cb-no" class="btn btn-secondary">Batal</button><button id="cb-ok" class="btn btn-primary">' + esc(okLabel) + '</button></div></div></div>';
    $('cb-no').onclick = () => { root.innerHTML = ''; }; $('cb-ok').onclick = () => { root.innerHTML = ''; onOk(); }; $('cb-no').focus();
  }

  /* ---------------- mulai aplikasi ---------------- */
  fillStart(); showResume();
  (async function () {
    let done = false;
    if (window.SOPCloud && SOPCloud.enabled()) {
      const r = await SOPCloud.pull();
      if (r.ok && String(r.bank.updatedAt || '') > String(S.bankInfo().updatedAt || '')) { S.applyRemote(r.bank); fillStart(); showResume(); }
      done = r.ok; SOPCloud.flush();
    }
    if (!done) { const r = await S.syncRemote(); if (r.updated) { fillStart(); showResume(); } }
  })();
  window.__quiz = { get state() { return st; } }; // untuk pengujian
})();
