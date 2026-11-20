/* ==========================================================
   Lengkapi SOP - dashboard trainer
   Rute (hash): #/ringkasan  #/pertanyaan  #/hasil  #/pengaturan  #/panduan
   ========================================================== */
(function () {
  'use strict';
  const S = window.SOPStore, UI = window.UI, esc = UI.esc, icon = UI.icon;
  const $ = id => document.getElementById(id);

  const ROUTES = [
    { id: 'ringkasan', label: 'Ringkasan', icon: 'home' },
    { id: 'pertanyaan', label: 'Pertanyaan', icon: 'list' },
    { id: 'hasil', label: 'Hasil Kuis', icon: 'chart' },
    { id: 'pengaturan', label: 'Pengaturan', icon: 'sliders' },
    { id: 'panduan', label: 'Panduan', icon: 'book' }
  ];
  const view = { q: { search: '', topic: '', type: '', status: '', page: 1, per: 10 }, h: { outlet: '' } };
  let route = 'ringkasan';
  const Cloud = window.SOPCloud;
  const RES = { list: [], source: 'lokal', loading: false, error: '' };
  function setCloud(state, extra) {
    const b = $('cloud-badge'); if (!b) return;
    const map = { off: ['bg-slate-100 text-slate-500', 'Cloud: belum aktif'], noauth: ['bg-amber-100 text-amber-700', 'Cloud: token belum diisi'], saving: ['bg-sky-100 text-sky-700', 'Cloud: menyimpan...'], ok: ['bg-emerald-100 text-emerald-700', 'Cloud: tersinkron'], err: ['bg-rose-100 text-rose-700', 'Cloud: gagal' + (extra ? ' (' + extra + ')' : '')] };
    const m = map[state] || map.off; b.className = 'badge ' + m[0]; b.textContent = m[1];
  }
  function cloudState() { return !Cloud || !Cloud.enabled() ? 'off' : (Cloud.token() ? 'ok' : 'noauth'); }
  let pushT = null;
  function schedulePush() {
    if (!Cloud || !Cloud.enabled()) { setCloud('off'); return; }
    if (!Cloud.token()) { setCloud('noauth'); return; }
    setCloud('saving'); clearTimeout(pushT); pushT = setTimeout(pushNow, 700);
  }
  async function pushNow() {
    const r = await Cloud.push(S.bankRaw(), Cloud.token());
    if (r.ok) setCloud('ok'); else { setCloud('err', r.error === 'unauthorized' ? 'token salah' : r.error); UI.toast('Gagal menyimpan ke cloud: ' + (r.error === 'unauthorized' ? 'token salah' : (r.error || 'periksa koneksi')), 'err'); }
    return r;
  }
  async function loadResults() {
    RES.loading = true; RES.error = '';
    if (Cloud && Cloud.enabled() && Cloud.token()) {
      const r = await Cloud.results(Cloud.token());
      if (r.ok) { RES.list = r.items; RES.source = 'cloud'; RES.loading = false; if (route === 'ringkasan' || route === 'hasil') render(); return; }
      RES.error = r.error;
    }
    RES.list = S.history(); RES.source = 'lokal'; RES.loading = false;
    if (route === 'ringkasan' || route === 'hasil') render();
  }
  async function cloudInit() {
    if (Cloud && Cloud.enabled()) {
      const r = await Cloud.pull();
      if (r.ok && String(r.bank.updatedAt || '') > String(S.bankInfo().updatedAt || '')) { S.applyRemote(r.bank); UI.toast('Soal diperbarui dari cloud.'); render(); }
      else if (r.ok && Cloud.token() && String(S.bankInfo().updatedAt || '') > String(r.bank.updatedAt || '')) { schedulePush(); }
      else if (!r.ok && Cloud.token() && S.questions().length) { schedulePush(); }
    }
    setCloud(cloudState()); loadResults();
  }

  /* ---------------- login ---------------- */
  let started = false;
  function authed() { return sessionStorage.getItem('lsop.auth') === '1'; }
  function boot() {
    if (authed()) { $('lock').classList.add('hidden'); $('lock').classList.remove('flex'); $('app').classList.remove('hidden'); if (!started) { started = true; start(); } return; }
    $('app').classList.add('hidden'); renderLogin();
  }
  function lockedFor() { const u = +sessionStorage.getItem('lsop.until') || 0; return Math.max(0, Math.ceil((u - Date.now()) / 1000)); }
  function renderLogin() {
    const el = $('lock'); el.classList.remove('hidden'); el.classList.add('flex');
    const ok = window.AdminAuth && AdminAuth.available() && AdminAuth.configured();
    el.innerHTML = '<form id="login-form" class="card w-full max-w-sm" autocomplete="off"><div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">' + icon('lock', 'h-6 w-6') + '</div><h1 class="mt-3 text-center text-lg font-semibold text-slate-900">Masuk Dashboard Trainer</h1><p class="mt-1 text-center text-sm text-slate-500">Khusus trainer. Masukkan nama pengguna dan sandi.</p>' +
      (ok ? '<div class="mt-5 space-y-3"><div><label class="label" for="lg-user">Nama pengguna</label><input id="lg-user" class="input" autocomplete="username" autocapitalize="off" spellcheck="false"></div><div><label class="label" for="lg-pass">Sandi</label><input id="lg-pass" type="password" class="input" autocomplete="current-password"></div></div><p id="lg-err" class="mt-3 hidden rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert"></p><button id="lg-btn" class="btn btn-primary mt-4 w-full" type="submit">Masuk</button>'
        : '<p class="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Login memerlukan koneksi aman. Buka halaman ini lewat <b>https://</b> (misalnya GitHub Pages) atau <b>http://localhost</b>.</p>') + '</form>';
    if (!ok) return;
    $('lg-user').focus();
    $('login-form').addEventListener('submit', async e => {
      e.preventDefault();
      const err = $('lg-err'), btn = $('lg-btn'), wait = lockedFor();
      const fail = m => { err.textContent = m; err.classList.remove('hidden'); };
      if (wait > 0) { fail('Terlalu banyak percobaan. Coba lagi dalam ' + wait + ' detik.'); return; }
      btn.disabled = true; btn.textContent = 'Memeriksa...';
      let good = false; try { good = await AdminAuth.verify($('lg-user').value, $('lg-pass').value); } catch (x) { good = false; }
      btn.disabled = false; btn.textContent = 'Masuk';
      if (good) { sessionStorage.setItem('lsop.auth', '1'); sessionStorage.removeItem('lsop.fail'); sessionStorage.removeItem('lsop.until'); boot(); return; }
      const n = (+sessionStorage.getItem('lsop.fail') || 0) + 1; sessionStorage.setItem('lsop.fail', n);
      if (n >= 5) { sessionStorage.setItem('lsop.until', Date.now() + 30000); sessionStorage.setItem('lsop.fail', 0); fail('Terlalu banyak percobaan. Tunggu 30 detik.'); }
      else fail('Nama pengguna atau sandi salah.');
      $('lg-pass').value = ''; $('lg-pass').focus();
    });
  }
  function logout() { sessionStorage.removeItem('lsop.auth'); closeModal(); location.hash = ''; boot(); }

  /* ---------------- kerangka & navigasi ---------------- */
  function start() {
    $('btn-menu').innerHTML = icon('menu');
    $('nav').innerHTML = ROUTES.map(r => '<a href="#/' + r.id + '" data-route="' + r.id + '" class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100">' + icon(r.icon) + r.label + '</a>').join('');
    S.onChange(schedulePush); setCloud(cloudState());
    window.addEventListener('hashchange', go); go(); cloudInit();
  }
  function go() {
    const id = (location.hash.match(/^#\/(\w+)/) || [])[1];
    route = ROUTES.some(r => r.id === id) ? id : 'ringkasan';
    document.querySelectorAll('#nav a').forEach(a => {
      const on = a.dataset.route === route;
      a.classList.toggle('bg-indigo-50', on); a.classList.toggle('text-indigo-700', on); a.classList.toggle('text-slate-600', !on);
    });
    closeMenu(); render();
  }
  function openMenu() { $('sidebar').classList.remove('-translate-x-full'); $('backdrop').classList.remove('hidden'); }
  function closeMenu() { $('sidebar').classList.add('-translate-x-full'); $('backdrop').classList.add('hidden'); }
  $('btn-menu').addEventListener('click', openMenu); $('backdrop').addEventListener('click', closeMenu);

  function render() {
    const def = ROUTES.find(r => r.id === route);
    $('page-title').textContent = def.label; $('page-actions').innerHTML = '';
    const v = $('view');
    if (route === 'ringkasan') { v.innerHTML = viewSummary(); }
    if (route === 'pertanyaan') { v.innerHTML = viewQuestions(); $('page-actions').innerHTML = '<button data-act="add" class="btn btn-primary">' + icon('plus', 'h-4 w-4') + 'Tambah pertanyaan</button>'; }
    if (route === 'hasil') { v.innerHTML = viewResults(); }
    if (route === 'pengaturan') { v.innerHTML = viewSettings(); }
    if (route === 'panduan') { v.innerHTML = viewGuide(); }
  }

  /* ---------------- ringkasan ---------------- */
  function stat(label, value, sub) { return '<div class="card"><p class="text-sm text-slate-500">' + label + '</p><p class="mt-1 text-3xl font-bold text-slate-900">' + value + '</p><p class="mt-1 text-xs text-slate-400">' + sub + '</p></div>'; }
  function viewSummary() {
    const qs = S.questions(), hist = RES.list, active = qs.filter(q => q.active !== false).length;
    const topics = {}; qs.forEach(q => { const t = topics[q.topic] || (topics[q.topic] = { n: 0, a: 0 }); t.n++; if (q.active !== false) t.a++; });
    const tl = Object.keys(topics).sort((a, b) => topics[b].n - topics[a].n || a.localeCompare(b, 'id'));
    const max = tl.length ? topics[tl[0]].n : 1;
    const avg = hist.length ? Math.round(hist.reduce((s, h) => s + h.pct, 0) / hist.length) : 0;
    const info = S.bankInfo();
    return '<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">' +
      stat('Total pertanyaan', qs.length, qs.filter(q => q.type === 'cloze').length + ' rumpang · ' + qs.filter(q => q.type === 'mcq').length + ' pilihan ganda') +
      stat('Pertanyaan aktif', active, (qs.length - active) + ' dinonaktifkan') +
      stat('Topik SOP', tl.length, 'Versi bank soal v' + info.version) +
      stat('Percobaan kuis', hist.length, hist.length ? 'Rata-rata skor ' + avg + '%' : (RES.source === 'cloud' ? 'Dari cloud' : 'Di browser ini')) + '</div>' +
      '<div class="mt-6 grid gap-4 xl:grid-cols-5"><div class="card xl:col-span-3"><div class="flex items-center justify-between"><h2 class="text-base font-semibold text-slate-900">Pertanyaan per topik</h2><a href="#/pertanyaan" class="text-sm font-medium text-indigo-600 hover:underline">Kelola</a></div>' +
      '<ul class="mt-4 space-y-3">' + (tl.slice(0, 12).map(t => '<li><div class="flex justify-between text-sm"><span class="text-slate-700">' + esc(t) + '</span><span class="text-slate-500">' + topics[t].a + '/' + topics[t].n + ' aktif</span></div><div class="mt-1 h-2 rounded-full bg-slate-100"><div class="h-2 rounded-full bg-indigo-500" style="width:' + Math.round(topics[t].n / max * 100) + '%"></div></div></li>').join('') || '<li class="text-sm text-slate-500">Belum ada pertanyaan.</li>') + '</ul>' + (tl.length > 12 ? '<p class="mt-3 text-xs text-slate-400">+' + (tl.length - 12) + ' topik lainnya</p>' : '') + '</div>' +
      '<div class="card xl:col-span-2"><div class="flex items-center justify-between"><h2 class="text-base font-semibold text-slate-900">Percobaan terbaru</h2><a href="#/hasil" class="text-sm font-medium text-indigo-600 hover:underline">Semua</a></div>' +
      (hist.length ? '<ul class="mt-3 divide-y divide-slate-100">' + hist.slice(0, 6).map(h => '<li class="flex items-center justify-between py-2.5 text-sm"><div><p class="font-medium text-slate-800">' + esc(h.nama) + '</p><p class="text-xs text-slate-400">' + esc(h.outlet) + ' · ' + UI.fmtDate(h.ts) + '</p></div><span class="badge ' + (h.pass ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700') + '">' + h.pct + '%</span></li>').join('') + '</ul>' : '<p class="mt-3 text-sm text-slate-500">Belum ada riwayat kuis di browser ini.</p>') + '</div></div>' +
      '<div class="mt-6 flex flex-wrap gap-2"><button data-act="add" class="btn btn-primary">' + icon('plus', 'h-4 w-4') + 'Tambah pertanyaan</button><button data-act="export" class="btn btn-secondary">' + icon('download', 'h-4 w-4') + 'Unduh questions.json</button></div>';
  }

  /* ---------------- pertanyaan (tabel) ---------------- */
  function filtered() {
    const f = view.q, s = f.search.trim().toLowerCase();
    return S.questions().filter(q =>
      (!f.topic || q.topic === f.topic) && (!f.type || q.type === f.type) &&
      (!f.status || (f.status === 'on') === (q.active !== false)) &&
      (!s || (q.text + ' ' + q.topic + ' ' + (q.options || []).join(' ') + ' ' + (q.explanation || '')).toLowerCase().includes(s)));
  }
  function preview(q) {
    if (q.type === 'cloze') return S.parseCloze(q.text).map(p => p.t !== undefined ? esc(p.t) : '<span class="mx-0.5 rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-semibold text-indigo-700">' + esc(p.a.join(' / ')) + '</span>').join('');
    return esc(q.text) + '<span class="mt-1 block text-xs text-emerald-700">✓ ' + esc((q.options || [])[q.correct] || '') + '</span>';
  }
  function switchHtml(on, id) {
    return '<button type="button" role="switch" aria-checked="' + on + '" aria-label="Status aktif" data-act="toggle" data-id="' + id + '" class="relative inline-flex h-6 w-11 flex-none rounded-full transition ' + (on ? 'bg-indigo-600' : 'bg-slate-300') + '"><span class="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition ' + (on ? 'translate-x-5' : '') + '"></span></button>';
  }
  function viewQuestions() {
    const f = view.q, list = filtered(), pages = Math.max(1, Math.ceil(list.length / f.per)); if (f.page > pages) f.page = pages;
    const rows = list.slice((f.page - 1) * f.per, f.page * f.per);
    const topics = S.topics();
    const opt = (v, l, sel) => '<option value="' + esc(v) + '"' + (sel ? ' selected' : '') + '>' + esc(l) + '</option>';
    return '<div class="card p-0">' +
      '<div class="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-4">' +
      '<div class="relative md:col-span-1"><span class="pointer-events-none absolute left-3 top-2.5 text-slate-400">' + icon('search', 'h-4 w-4') + '</span><input id="q-search" class="input pl-9" placeholder="Cari pertanyaan..." value="' + esc(f.search) + '" aria-label="Cari"></div>' +
      '<select id="q-topic" class="input" aria-label="Topik">' + opt('', 'Semua topik', !f.topic) + topics.map(t => opt(t, t, f.topic === t)).join('') + '</select>' +
      '<select id="q-type" class="input" aria-label="Tipe">' + opt('', 'Semua tipe', !f.type) + opt('cloze', 'Teks rumpang', f.type === 'cloze') + opt('mcq', 'Pilihan ganda', f.type === 'mcq') + '</select>' +
      '<select id="q-status" class="input" aria-label="Status">' + opt('', 'Semua status', !f.status) + opt('on', 'Aktif', f.status === 'on') + opt('off', 'Nonaktif', f.status === 'off') + '</select></div>' +
      '<div class="overflow-x-auto"><table class="min-w-full text-left text-sm"><thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th class="px-4 py-3 font-semibold">Pertanyaan</th><th class="px-4 py-3 font-semibold">Topik</th><th class="px-4 py-3 font-semibold">Tipe</th><th class="px-4 py-3 font-semibold">Aktif</th><th class="px-4 py-3 text-right font-semibold">Aksi</th></tr></thead><tbody class="divide-y divide-slate-100">' +
      (rows.length ? rows.map(q => '<tr class="align-top ' + (q.active === false ? 'bg-slate-50/60 text-slate-400' : '') + '"><td class="max-w-md px-4 py-3 leading-6">' + preview(q) + '</td><td class="whitespace-nowrap px-4 py-3 text-slate-600">' + esc(q.topic) + '</td><td class="px-4 py-3"><span class="badge ' + (q.type === 'cloze' ? 'bg-indigo-50 text-indigo-700' : 'bg-sky-50 text-sky-700') + '">' + (q.type === 'cloze' ? 'Rumpang' : 'Pilihan ganda') + '</span></td><td class="px-4 py-3">' + switchHtml(q.active !== false, q.id) + '</td><td class="whitespace-nowrap px-4 py-3 text-right"><button data-act="edit" data-id="' + q.id + '" class="btn btn-ghost px-2 py-1.5" aria-label="Edit" title="Edit">' + icon('pencil', 'h-4 w-4') + '</button><button data-act="dup" data-id="' + q.id + '" class="btn btn-ghost px-2 py-1.5" aria-label="Duplikat" title="Duplikat">' + icon('copy', 'h-4 w-4') + '</button><button data-act="del" data-id="' + q.id + '" class="btn btn-ghost px-2 py-1.5 text-rose-600 hover:bg-rose-50" aria-label="Hapus" title="Hapus">' + icon('trash', 'h-4 w-4') + '</button></td></tr>').join('')
        : '<tr><td colspan="5" class="px-4 py-12 text-center text-slate-500">Tidak ada pertanyaan yang cocok. <button data-act="add" class="font-medium text-indigo-600 hover:underline">Tambah pertanyaan</button></td></tr>') +
      '</tbody></table></div>' +
      '<div class="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500"><span>' + list.length + ' pertanyaan · halaman ' + f.page + ' dari ' + pages + '</span><div class="flex gap-2"><button data-act="page" data-d="-1" class="btn btn-secondary px-3 py-1.5" ' + (f.page <= 1 ? 'disabled' : '') + '>Sebelumnya</button><button data-act="page" data-d="1" class="btn btn-secondary px-3 py-1.5" ' + (f.page >= pages ? 'disabled' : '') + '>Berikutnya</button></div></div></div>';
  }

  /* ---------------- hasil kuis ---------------- */
  function viewResults() {
    const all = RES.list, f = view.h, list = all.filter(h => !f.outlet || h.outlet === f.outlet);
    const outlets = Array.from(new Set(all.map(h => h.outlet))).sort();
    return '<div class="card p-0"><div class="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4"><select id="h-outlet" class="input w-auto" aria-label="Outlet"><option value="">Semua outlet</option>' + outlets.map(o => '<option' + (f.outlet === o ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select><div class="ml-auto flex flex-wrap gap-2"><button data-act="reload" class="btn btn-secondary">' + icon('refresh', 'h-4 w-4') + (RES.loading ? 'Memuat...' : 'Muat ulang') + '</button><button data-act="csv" class="btn btn-secondary">' + icon('download', 'h-4 w-4') + 'Unduh CSV</button><button data-act="clearhist" class="btn btn-secondary text-rose-600">' + icon('trash', 'h-4 w-4') + 'Hapus hasil</button></div></div>' +
      '<p class="border-b border-slate-100 px-4 py-2 text-xs ' + (RES.source === 'cloud' ? 'text-emerald-700' : 'text-amber-700') + '">' + (RES.source === 'cloud' ? 'Sumber: cloud (hasil dari semua perangkat).' : 'Sumber: browser ini saja.' + (RES.error ? ' Cloud: ' + esc(RES.error) + '.' : ' Aktifkan cloud di Pengaturan agar hasil semua perangkat terkumpul di sini.')) + '</p>' +
      '<div class="overflow-x-auto"><table class="min-w-full text-left text-sm"><thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th class="px-4 py-3 font-semibold">Waktu</th><th class="px-4 py-3 font-semibold">Nama</th><th class="px-4 py-3 font-semibold">Outlet</th><th class="px-4 py-3 font-semibold">Topik</th><th class="px-4 py-3 font-semibold">Skor</th><th class="px-4 py-3 text-right font-semibold">Detail</th></tr></thead><tbody class="divide-y divide-slate-100">' +
      (list.length ? list.map(h => '<tr><td class="whitespace-nowrap px-4 py-3 text-slate-500">' + UI.fmtDate(h.ts) + '</td><td class="px-4 py-3 font-medium text-slate-800">' + esc(h.nama) + '</td><td class="px-4 py-3">' + esc(h.outlet) + '</td><td class="px-4 py-3">' + esc(h.topic) + '</td><td class="px-4 py-3"><span class="badge ' + (h.pass ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700') + '">' + h.pct + '%</span> <span class="text-xs text-slate-400">' + h.points + '/' + h.total + '</span></td><td class="px-4 py-3 text-right"><button data-act="hdetail" data-id="' + h.id + '" class="font-medium text-indigo-600 hover:underline">' + ((h.wrong || []).length ? h.wrong.length + ' salah' : 'Lihat') + '</button></td></tr>').join('')
        : '<tr><td colspan="6" class="px-4 py-12 text-center text-slate-500">Belum ada hasil.</td></tr>') + '</tbody></table></div></div>';
  }

  /* ---------------- pengaturan ---------------- */
  function viewSettings() {
    const s = S.settings(), info = S.bankInfo();
    return '<div class="mx-auto max-w-3xl space-y-4">' +
      '<form id="set-form" class="card space-y-4"><h2 class="text-base font-semibold text-slate-900">Umum</h2>' +
      '<div><label class="label" for="s-outlets">Daftar outlet (satu per baris)</label><textarea id="s-outlets" rows="5" class="input">' + esc(s.outlets.join('\n')) + '</textarea></div>' +
      '<div class="grid gap-4 sm:grid-cols-2"><div><label class="label" for="s-count">Jumlah soal bawaan</label><input id="s-count" type="number" min="3" max="50" class="input" value="' + s.quizCount + '"></div><div><label class="label" for="s-pass">Nilai lulus (%)</label><input id="s-pass" type="number" min="1" max="100" class="input" value="' + s.passScore + '"></div></div>' +
      '<div class="flex justify-end"><button class="btn btn-primary" type="submit">Simpan pengaturan</button></div></form>' +
      '<form id="auth-form" class="card space-y-4" autocomplete="off"><div><h2 class="text-base font-semibold text-slate-900">Akun admin</h2><p class="mt-1 text-sm text-slate-500">Nama pengguna saat ini: <b>' + esc(AdminAuth.username()) + '</b>. Setelah mengganti sandi, unggah file <code>auth-config.js</code> yang diunduh ke folder <code>js/</code> di GitHub agar berlaku di semua perangkat.</p></div>' +
      '<div class="grid gap-4 sm:grid-cols-2"><div class="sm:col-span-2"><label class="label" for="a-cur">Sandi saat ini</label><input id="a-cur" type="password" class="input" autocomplete="current-password"></div><div><label class="label" for="a-user">Nama pengguna baru</label><input id="a-user" class="input" value="' + esc(AdminAuth.username()) + '" autocapitalize="off"></div><div></div><div><label class="label" for="a-new">Sandi baru (min. 8 karakter)</label><input id="a-new" type="password" class="input" autocomplete="new-password"></div><div><label class="label" for="a-rep">Ulangi sandi baru</label><input id="a-rep" type="password" class="input" autocomplete="new-password"></div></div>' +
      '<div class="flex justify-end"><button class="btn btn-secondary" type="submit">Ganti sandi dan unduh auth-config.js</button></div></form>' +
      '<form id="cloud-form" class="card space-y-4" autocomplete="off"><div><h2 class="text-base font-semibold text-slate-900">Sinkronisasi cloud</h2><p class="mt-1 text-sm text-slate-500">Menyimpan bank soal dan hasil kuis di Google Sheets milikmu agar dibagikan ke semua perangkat. Pasang backend dulu dengan panduan <code>cloud/PANDUAN-CLOUD.md</code>.</p></div>' +
      '<div><label class="label" for="c-url">Alamat Web App (Apps Script)</label><input id="c-url" class="input" placeholder="https://script.google.com/macros/s/.../exec" value="' + esc(Cloud ? Cloud.url() : '') + '"></div>' +
      '<div><label class="label" for="c-token">Token admin</label><input id="c-token" type="password" class="input" autocomplete="off" placeholder="Sama dengan ADMIN_TOKEN di Code.gs" value="' + esc(Cloud ? Cloud.token() : '') + '"><p class="mt-1 text-xs text-slate-500">Token hanya disimpan di browser ini dan tidak ikut ke GitHub.</p></div>' +
      '<p id="c-status" class="hidden rounded-lg px-3 py-2 text-sm" role="status"></p>' +
      '<div class="flex flex-wrap justify-end gap-2"><button type="button" data-act="cloudtest" class="btn btn-secondary">Uji koneksi</button><button type="button" data-act="cloudpush" class="btn btn-secondary">Kirim bank soal sekarang</button><button class="btn btn-primary" type="submit">Simpan dan unduh config.js</button></div>' +
      '<p class="text-xs text-slate-500">Setelah menyimpan, unggah <code>config.js</code> hasil unduhan ke folder <code>js/</code> di GitHub supaya perangkat crew tahu alamat cloud-nya.</p></form>' +
      '<div class="card space-y-3"><h2 class="text-base font-semibold text-slate-900">Data pertanyaan</h2><p class="text-sm text-slate-500">Versi v' + info.version + ' · ' + info.count + ' pertanyaan · diperbarui ' + UI.fmtDate(info.updatedAt) + '. Data tersimpan di browser ini. Untuk membagikannya ke perangkat crew, unduh <code>questions.json</code> lalu letakkan di folder <code>data/</code> pada hosting.</p>' +
      '<div class="flex flex-wrap gap-2"><button data-act="export" class="btn btn-secondary">' + icon('download', 'h-4 w-4') + 'Unduh questions.json</button><label class="btn btn-secondary cursor-pointer">' + icon('upload', 'h-4 w-4') + 'Impor JSON<input id="imp-file" type="file" accept="application/json,.json" class="sr-only"></label>' +
      '<label class="flex items-center gap-2 text-sm text-slate-600"><input type="radio" name="imp-mode" value="merge" checked> Gabungkan</label><label class="flex items-center gap-2 text-sm text-slate-600"><input type="radio" name="imp-mode" value="replace"> Ganti semua</label></div>' +
      '<div class="border-t border-slate-100 pt-3"><button data-act="reset" class="btn btn-ghost text-rose-600">' + icon('refresh', 'h-4 w-4') + 'Kembalikan ke data awal</button></div></div></div>';
  }

  /* ---------------- panduan ---------------- */
  function viewGuide() {
    const step = (n, t, d) => '<li class="flex gap-3"><span class="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">' + n + '</span><div><p class="font-medium text-slate-900">' + t + '</p><p class="mt-0.5 text-sm text-slate-600">' + d + '</p></div></li>';
    return '<div class="mx-auto max-w-3xl space-y-4">' +
      '<div class="card"><h2 class="text-base font-semibold text-slate-900">Menambah pertanyaan</h2><ol class="mt-4 space-y-4">' +
      step(1, 'Buka menu Pertanyaan', 'Klik <b>Tambah pertanyaan</b> di pojok kanan atas.') +
      step(2, 'Isi topik dan pilih tipe', 'Topik adalah nama SOP (misalnya Thawing Ayam). Ketik topik baru atau pilih yang sudah ada.') +
      step(3, 'Tulis kalimat atau pertanyaan', 'Teks rumpang: bungkus jawaban dengan <code>[[ ]]</code>, contoh <code>Suhu chiller [[2-5]] °C</code>. Beberapa jawaban yang diterima dipisah <code>|</code>, contoh <code>[[golden brown|keemasan]]</code>. Pilihan ganda: isi pilihan dan tandai bulatan pada jawaban yang benar.') +
      step(4, 'Periksa pratinjau lalu simpan', 'Tombol Simpan aktif setelah isian valid. Pertanyaan baru langsung muncul di kuis.') + '</ol></div>' +
      '<div class="card"><h2 class="text-base font-semibold text-slate-900">Mengubah, menonaktifkan, atau menghapus</h2><ul class="mt-3 space-y-2 text-sm text-slate-600"><li><b>Edit</b>: ikon pensil pada baris pertanyaan.</li><li><b>Duplikat</b>: ikon salin, berguna untuk membuat variasi kalimat.</li><li><b>Nonaktifkan</b>: geser saklar Aktif. Pertanyaan disembunyikan dari kuis tanpa dihapus.</li><li><b>Hapus</b>: ikon tempat sampah, lalu konfirmasi. Hapus permanen tidak bisa dibatalkan, jadi unduh cadangan dulu bila ragu.</li></ul></div>' +
      '<div class="card"><h2 class="text-base font-semibold text-slate-900">Membagikan ke perangkat crew</h2><ol class="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-slate-600"><li>Setelah selesai mengubah, buka Pengaturan lalu <b>Unduh questions.json</b>.</li><li>Ganti file <code>data/questions.json</code> di hosting dengan file hasil unduhan.</li><li>Saat crew membuka halaman kuis, soal terbaru diambil otomatis bila versinya lebih baru.</li></ol><p class="mt-3 text-sm text-slate-500">LocalStorage hanya menyimpan data di browser tempat kamu bekerja. Tanpa langkah di atas, perubahan tidak sampai ke perangkat lain.</p></div></div>';
  }

  /* ---------------- modal ---------------- */
  function modal(inner, wide) {
    $('modal-root').innerHTML = '<div id="mbg" class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4"><div class="max-h-[92vh] w-full ' + (wide ? 'max-w-2xl' : 'max-w-md') + ' overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl" role="dialog" aria-modal="true">' + inner + '</div></div>';
    $('mbg').addEventListener('mousedown', e => { if (e.target === $('mbg')) closeModal(); });
  }
  function closeModal() { $('modal-root').innerHTML = ''; }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  function confirmBox(title, body, okLabel, danger, onOk) {
    modal('<div class="p-5"><h2 class="text-base font-semibold text-slate-900">' + esc(title) + '</h2><div class="mt-2 text-sm text-slate-600">' + body + '</div><div class="mt-5 flex justify-end gap-2"><button data-act="close" class="btn btn-secondary">Batal</button><button id="ok-btn" class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '">' + esc(okLabel) + '</button></div></div>');
    $('ok-btn').onclick = () => { closeModal(); onOk(); };
  }

  /* ---------------- form pertanyaan (tambah/ubah) ---------------- */
  let F = null, editId = null;
  function openForm(id) {
    editId = id || null;
    const q = id ? S.getQuestion(id) : null;
    F = q ? { topic: q.topic, type: q.type, text: q.text, options: q.type === 'mcq' ? q.options.slice() : ['', '', '', ''], correct: q.correct || 0, explanation: q.explanation || '', active: q.active !== false }
          : { topic: view.q.topic || '', type: 'cloze', text: '', options: ['', '', '', ''], correct: 0, explanation: '', active: true };
    modal(formHtml(), true); bindForm(); refreshForm();
    document.getElementById('f-topic').focus();
  }
  function formHtml() {
    return '<div class="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h2 class="text-base font-semibold text-slate-900">' + (editId ? 'Ubah pertanyaan' : 'Tambah pertanyaan') + '</h2><button data-act="close" class="btn btn-ghost px-2 py-1.5" aria-label="Tutup">' + icon('x') + '</button></div>' +
      '<form id="q-form" class="space-y-5 px-5 py-5" autocomplete="off">' +
      '<div><label class="label" for="f-topic">Topik SOP</label><input id="f-topic" class="input" list="topic-list" placeholder="Contoh: Thawing Ayam" value="' + esc(F.topic) + '"><datalist id="topic-list">' + S.topics().map(t => '<option value="' + esc(t) + '">').join('') + '</datalist></div>' +
      '<div><span class="label">Tipe pertanyaan</span><div class="grid grid-cols-2 gap-2" role="radiogroup">' +
        ['cloze|Teks rumpang|Lengkapi bagian kosong', 'mcq|Pilihan ganda|Pilih satu jawaban'].map(t => { const p = t.split('|'); return '<label class="flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm ' + (F.type === p[0] ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' : 'border-slate-200') + '"><input type="radio" name="f-type" value="' + p[0] + '" class="mt-1" ' + (F.type === p[0] ? 'checked' : '') + '><span><span class="block font-medium text-slate-900">' + p[1] + '</span><span class="text-xs text-slate-500">' + p[2] + '</span></span></label>'; }).join('') + '</div></div>' +
      '<div id="blk-cloze" class="' + (F.type === 'cloze' ? '' : 'hidden') + '"><label class="label" for="f-text">Kalimat SOP</label><textarea id="f-text" rows="3" class="input" placeholder="Suhu chiller untuk thawing [[2-5]] °C.">' + (F.type === 'cloze' ? esc(F.text) : '') + '</textarea><p class="mt-1 text-xs text-slate-500">Tulis jawaban di dalam <code>[[ ]]</code>. Beberapa jawaban yang diterima: <code>[[golden brown|keemasan]]</code>.</p><div class="mt-3 rounded-xl bg-slate-50 p-3"><p class="text-xs font-medium uppercase tracking-wide text-slate-400">Pratinjau jawaban</p><p id="f-prev" class="mt-1 text-sm leading-7 text-slate-800"></p></div></div>' +
      '<div id="blk-mcq" class="' + (F.type === 'mcq' ? '' : 'hidden') + '"><label class="label" for="f-qtext">Pertanyaan</label><textarea id="f-qtext" rows="2" class="input" placeholder="Berapa suhu chiller untuk thawing?">' + (F.type === 'mcq' ? esc(F.text) : '') + '</textarea><span class="label mt-4">Pilihan jawaban <span class="font-normal text-slate-400">(pilih bulatan untuk jawaban benar)</span></span><div id="f-opts" class="space-y-2"></div><button type="button" data-act="addopt" class="mt-2 text-sm font-medium text-indigo-600 hover:underline">+ Tambah pilihan</button></div>' +
      '<div><label class="label" for="f-exp">Penjelasan <span class="font-normal text-slate-400">(opsional, tampil setelah peserta menjawab)</span></label><textarea id="f-exp" rows="2" class="input">' + esc(F.explanation) + '</textarea></div>' +
      '<div class="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><div><p class="text-sm font-medium text-slate-900">Aktif di kuis</p><p class="text-xs text-slate-500">Nonaktif = disembunyikan dari peserta</p></div><div id="f-switch"></div></div>' +
      '<ul id="f-errs" class="space-y-1 text-sm text-amber-700"></ul></form>' +
      '<div class="flex justify-end gap-2 border-t border-slate-100 px-5 py-4"><button data-act="close" class="btn btn-secondary">Batal</button><button id="f-save" data-act="save" class="btn btn-primary">' + (editId ? 'Simpan perubahan' : 'Simpan pertanyaan') + '</button></div>';
  }
  function optsHtml() {
    return F.options.map((o, i) => '<div class="flex items-center gap-2"><input type="radio" name="f-correct" data-i="' + i + '" ' + (F.correct === i ? 'checked' : '') + ' aria-label="Jawaban benar ' + (i + 1) + '" class="h-4 w-4 flex-none"><input data-o="' + i + '" class="input" value="' + esc(o) + '" placeholder="Pilihan ' + 'ABCDEF'[i] + '"><button type="button" data-act="rmopt" data-i="' + i + '" class="btn btn-ghost px-2 py-1.5" aria-label="Hapus pilihan">' + icon('x', 'h-4 w-4') + '</button></div>').join('');
  }
  function bindForm() {
    const f = $('q-form');
    $('f-opts').innerHTML = optsHtml(); $('f-switch').innerHTML = switchHtml(F.active, 'form');
    f.addEventListener('input', e => {
      const t = e.target;
      if (t.id === 'f-topic') F.topic = t.value;
      else if (t.id === 'f-text' || t.id === 'f-qtext') F.text = t.value;
      else if (t.id === 'f-exp') F.explanation = t.value;
      else if (t.dataset.o !== undefined) F.options[+t.dataset.o] = t.value;
      refreshForm();
    });
    f.addEventListener('change', e => {
      const t = e.target;
      if (t.name === 'f-type') {
        const txt = F.type === 'cloze' ? $('f-text').value : $('f-qtext').value;
        F.type = t.value; F.text = txt; $('f-text').value = F.type === 'cloze' ? txt : ''; $('f-qtext').value = F.type === 'mcq' ? txt : '';
        $('blk-cloze').classList.toggle('hidden', F.type !== 'cloze'); $('blk-mcq').classList.toggle('hidden', F.type !== 'mcq');
        f.querySelectorAll('[name="f-type"]').forEach(r => r.closest('label').className = 'flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm ' + (r.checked ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' : 'border-slate-200'));
        refreshForm();
      } else if (t.name === 'f-correct') { F.correct = +t.dataset.i; refreshForm(); }
    });
    f.addEventListener('submit', e => e.preventDefault());
  }
  function refreshForm() {
    const errs = S.validate(F);
    $('f-errs').innerHTML = (F.topic || F.text) ? errs.map(e => '<li>• ' + esc(e) + '</li>').join('') : '';
    $('f-save').disabled = errs.length > 0;
    if (F.type === 'cloze') {
      const parts = S.parseCloze(F.text || '');
      $('f-prev').innerHTML = parts.length ? parts.map(p => p.t !== undefined ? esc(p.t) : '<span class="mx-0.5 rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-semibold text-indigo-800">' + esc(p.a.join(' / ')) + '</span>').join('') + '<span class="ml-2 text-xs text-slate-400">(' + parts.filter(p => p.a).length + ' rumpang)</span>' : '<span class="text-slate-400">Belum ada kalimat.</span>';
    }
  }

  /* ---------------- aksi (delegasi klik) ---------------- */
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const act = el.dataset.act, id = el.dataset.id;
    switch (act) {
      case 'close': closeModal(); break;
      case 'add': openForm(); break;
      case 'edit': openForm(id); break;
      case 'dup': { const c = S.duplicateQuestion(id); if (c) { UI.toast('Pertanyaan diduplikasi.'); render(); } break; }
      case 'toggle':
        if (id === 'form') { F.active = !F.active; $('f-switch').innerHTML = switchHtml(F.active, 'form'); }
        else { S.setActive(id, el.getAttribute('aria-checked') !== 'true'); render(); }
        break;
      case 'del': {
        const q = S.getQuestion(id); if (!q) break;
        confirmBox('Hapus pertanyaan ini?', '<p class="rounded-lg bg-slate-50 p-3 text-slate-700">' + preview(q) + '</p><p class="mt-3">Penghapusan bersifat permanen dan tidak bisa dibatalkan.</p>', 'Ya, hapus', true, () => { S.deleteQuestion(id); UI.toast('Pertanyaan dihapus.'); render(); });
        break;
      }
      case 'save': {
        const r = editId ? S.updateQuestion(editId, F) : S.addQuestion(F);
        if (!r.ok) { UI.toast(r.errors[0], 'err'); break; }
        closeModal(); UI.toast(editId ? 'Perubahan disimpan.' : 'Pertanyaan ditambahkan.');
        if (route !== 'pertanyaan') location.hash = '#/pertanyaan'; else render();
        break;
      }
      case 'addopt': if (F.options.length < 6) { F.options.push(''); $('f-opts').innerHTML = optsHtml(); refreshForm(); } break;
      case 'rmopt': {
        if (F.options.length <= 2) { UI.toast('Minimal 2 pilihan jawaban.', 'err'); break; }
        const i = +el.dataset.i; F.options.splice(i, 1); if (F.correct === i) F.correct = 0; else if (F.correct > i) F.correct--;
        $('f-opts').innerHTML = optsHtml(); refreshForm(); break;
      }
      case 'page': view.q.page += +el.dataset.d; render(); break;
      case 'export': UI.download('questions.json', S.exportBank(), 'application/json'); UI.toast('questions.json diunduh.'); break;
      case 'csv': exportCsv(); break;
      case 'reload': loadResults(); break;
      case 'cloudtest': cloudTest(); break;
      case 'cloudpush': cloudPushNow(); break;
      case 'clearhist': confirmBox('Hapus semua hasil?', 'Hasil kuis di browser ini' + (RES.source === 'cloud' ? ' dan di cloud' : '') + ' akan dihapus permanen.', 'Ya, hapus', true, async () => { S.clearHistory(); if (RES.source === 'cloud') await Cloud.clearResults(Cloud.token()); loadResults(); }); break;
      case 'hdetail': showHistoryDetail(id); break;
      case 'logout': logout(); break;
      case 'reset': confirmBox('Kembalikan ke data awal?', 'Semua pertanyaan yang kamu tambah atau ubah akan diganti dengan data awal. Unduh cadangan dulu bila perlu.', 'Ya, kembalikan', true, () => { S.resetBank(); UI.toast('Data dikembalikan ke awal.'); render(); }); break;
    }
  });

  /* filter dan formulir pengaturan */
  document.addEventListener('input', e => {
    if (e.target.id === 'q-search') { view.q.search = e.target.value; view.q.page = 1; const pos = e.target.selectionStart; render(); const el = $('q-search'); if (el) { el.focus(); el.setSelectionRange(pos, pos); } }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'q-topic') { view.q.topic = t.value; view.q.page = 1; render(); }
    else if (t.id === 'q-type') { view.q.type = t.value; view.q.page = 1; render(); }
    else if (t.id === 'q-status') { view.q.status = t.value; view.q.page = 1; render(); }
    else if (t.id === 'h-outlet') { view.h.outlet = t.value; render(); }
    else if (t.id === 'imp-file' && t.files[0]) {
      const mode = (document.querySelector('[name="imp-mode"]:checked') || {}).value || 'merge', rd = new FileReader();
      rd.onload = () => { const r = S.importBank(String(rd.result), mode); if (r.ok) { UI.toast(r.added + ' ditambahkan, ' + r.updated + ' diperbarui' + (r.skipped ? ', ' + r.skipped + ' dilewati karena tidak valid' : '') + '.'); render(); } else UI.toast(r.error, 'err'); };
      rd.readAsText(t.files[0]); t.value = '';
    }
  });
  document.addEventListener('submit', async e => {
    if (e.target.id === 'auth-form') { e.preventDefault(); await changeAuth(); return; }
    if (e.target.id === 'cloud-form') {
      e.preventDefault(); Cloud.setUrl($('c-url').value); Cloud.setToken($('c-token').value);
      UI.download('config.js', Cloud.configText($('c-url').value), 'text/javascript'); setCloud(cloudState());
      cStatus('Tersimpan di browser ini. Unggah config.js ke folder js/ di GitHub agar perangkat crew memakai cloud.', true); cloudInit(); return;
    }
    if (e.target.id !== 'set-form') return; e.preventDefault();
    const outlets = $('s-outlets').value.split('\n').map(s => s.trim()).filter(Boolean);
    if (!outlets.length) { UI.toast('Isi minimal satu outlet.', 'err'); return; }
    const count = Math.min(50, Math.max(3, parseInt($('s-count').value, 10) || 10)), pass = Math.min(100, Math.max(1, parseInt($('s-pass').value, 10) || 70));
    S.saveSettings({ outlets: Array.from(new Set(outlets)), quizCount: count, passScore: pass }); UI.toast('Pengaturan disimpan.'); render();
  });

  function cStatus(msg, good) {
    const el = $('c-status'); if (!el) return; el.textContent = msg; el.classList.remove('hidden', 'bg-emerald-50', 'text-emerald-700', 'bg-rose-50', 'text-rose-700');
    el.classList.add(good ? 'bg-emerald-50' : 'bg-rose-50', good ? 'text-emerald-700' : 'text-rose-700');
  }
  async function cloudTest() {
    const url = $('c-url').value.trim(), token = $('c-token').value.trim();
    if (!url) { cStatus('Isi alamat Web App dulu.', false); return; }
    cStatus('Menguji koneksi...', true);
    const r = await Cloud.ping(token, url);
    if (!r.ok) { cStatus('Gagal terhubung: ' + (r.error || 'periksa alamat dan pengaturan akses (Anyone).'), false); return; }
    if (!r.configured) { cStatus('Terhubung, tetapi ADMIN_TOKEN di Code.gs belum diganti.', false); return; }
    if (token && r.tokenOk === false) { cStatus('Terhubung, tetapi token tidak cocok dengan ADMIN_TOKEN di Code.gs.', false); return; }
    cStatus(token ? 'Terhubung dan token benar.' : 'Terhubung. Isi token admin untuk menyimpan soal.', true);
  }
  async function cloudPushNow() {
    Cloud.setUrl($('c-url').value); Cloud.setToken($('c-token').value);
    if (!Cloud.enabled() || !Cloud.token()) { cStatus('Isi alamat Web App dan token dulu.', false); return; }
    cStatus('Mengirim bank soal...', true); setCloud('saving');
    const r = await pushNow();
    cStatus(r.ok ? 'Bank soal terkirim (' + r.count + ' pertanyaan).' : 'Gagal: ' + (r.error === 'unauthorized' ? 'token salah' : (r.error || 'periksa koneksi')), !!r.ok);
  }

  async function changeAuth() {
    const cur = $('a-cur').value, user = $('a-user').value.trim(), np = $('a-new').value, rp = $('a-rep').value;
    if (!(await AdminAuth.verify(AdminAuth.username(), cur))) { UI.toast('Sandi saat ini salah.', 'err'); return; }
    if (!user) { UI.toast('Nama pengguna tidak boleh kosong.', 'err'); return; }
    if (np.length < 8) { UI.toast('Sandi baru minimal 8 karakter.', 'err'); return; }
    if (np !== rp) { UI.toast('Ulangi sandi tidak sama.', 'err'); return; }
    const cfg = await AdminAuth.create(user, np);
    AdminAuth.useLocal(cfg); UI.download('auth-config.js', AdminAuth.fileText(cfg), 'text/javascript');
    modal('<div class="p-5"><h2 class="text-base font-semibold text-slate-900">Sandi diganti di browser ini</h2><p class="mt-2 text-sm text-slate-600">File <code>auth-config.js</code> sudah diunduh. Supaya sandi baru juga berlaku di perangkat lain, unggah file itu ke folder <code>js/</code> di repositori GitHub (timpa file lama), lalu <b>Commit changes</b>.</p><p class="mt-2 text-sm text-slate-600">Sebelum diunggah, sandi lama masih berlaku di perangkat lain.</p><div class="mt-5 flex justify-end"><button data-act="close" class="btn btn-primary">Mengerti</button></div></div>');
    render();
  }

  function showHistoryDetail(id) {
    const h = RES.list.find(x => x.id === id); if (!h) return;
    modal('<div class="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 class="text-base font-semibold text-slate-900">' + esc(h.nama) + ' · ' + h.pct + '%</h2><p class="text-xs text-slate-500">' + esc(h.outlet) + ' · ' + esc(h.topic) + ' · ' + UI.fmtDate(h.ts) + '</p></div><button data-act="close" class="btn btn-ghost px-2 py-1.5" aria-label="Tutup">' + icon('x') + '</button></div><div class="px-5 py-4">' +
      ((h.wrong || []).length ? '<ul class="divide-y divide-slate-100">' + h.wrong.map(w => '<li class="py-3 text-sm"><p class="text-xs text-slate-400">' + esc(w.topic) + '</p><p class="mt-0.5 text-slate-800">' + esc(w.text) + '</p><p class="mt-1 text-slate-500">' + (w.mcq ? 'Jawaban: <b class="text-rose-600">' + esc(w.u) + '</b> · Benar: <b class="text-emerald-600">' + esc(w.a) + '</b>' : w.detail.map(d => '<b class="text-rose-600">' + esc(d.u || 'kosong') + '</b> → <b class="text-emerald-600">' + esc(d.a) + '</b>').join(' · ')) + '</p></li>').join('') + '</ul>' : '<p class="text-sm text-slate-600">Semua jawaban benar.</p>') + '</div>', true);
  }
  function exportCsv() {
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const rows = [['Waktu', 'Nama', 'Outlet', 'Topik', 'Poin', 'Total', 'Persen', 'Status'].map(q).join(',')].concat(
      RES.list.filter(h => !view.h.outlet || h.outlet === view.h.outlet).map(h => [new Date(h.ts).toLocaleString('id-ID'), h.nama, h.outlet, h.topic, h.points, h.total, h.pct + '%', h.pass ? 'Lulus' : 'Belum lulus'].map(q).join(',')));
    UI.download('hasil-kuis.csv', '\ufeff' + rows.join('\n'), 'text/csv'); UI.toast('CSV diunduh.');
  }

  boot();
})();
