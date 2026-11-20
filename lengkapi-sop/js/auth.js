/* ==========================================================
   Lengkapi SOP - login dashboard trainer
   Kredensial berupa hash PBKDF2-SHA256 (js/auth-config.js), bukan sandi asli.
   Catatan: ini gerbang di sisi browser. Ia mencegah akses iseng, tetapi
   bukan pengganti keamanan server. Perubahan di dashboard hanya berlaku di
   browser pemakainya; soal untuk crew hanya berubah jika kamu mengunggah
   data/questions.json ke repositori.
   ========================================================== */
(function (g) {
  'use strict';
  const LK = 'lsop.auth.local';
  const enc = new TextEncoder();
  const b64 = buf => { let s = ''; new Uint8Array(buf).forEach(c => { s += String.fromCharCode(c); }); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

  function available() { return !!(g.crypto && g.crypto.subtle && g.TextEncoder); }
  async function derive(pw, saltB64, iter) {
    const key = await g.crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
    const bits = await g.crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(saltB64), iterations: iter }, key, 256);
    return b64(bits);
  }
  function readLocal() { try { return JSON.parse(localStorage.getItem(LK) || 'null'); } catch (e) { return null; } }
  function dropLocal() { try { localStorage.removeItem(LK); } catch (e) { /* diabaikan */ } }

  /* Kredensial aktif: file auth-config.js. Setelah "Ganti sandi", versi lokal dipakai
     sementara sampai file baru diunggah (lalu otomatis dibuang). */
  function active() {
    const e = g.ADMIN_AUTH || null, l = readLocal();
    if (!l) return e;
    if (!e) return l.cfg;
    if (l.cfg.hash === e.hash) { dropLocal(); return e; }
    if (l.base === e.hash) return l.cfg;
    dropLocal(); return e;
  }

  const Auth = {
    available,
    configured() { return !!active(); },
    username() { const c = active(); return c ? c.user : ''; },
    async verify(user, pw) {
      const c = active(); if (!c || !available()) return false;
      if (String(user || '').trim().toLowerCase() !== String(c.user).toLowerCase()) return false;
      return (await derive(String(pw || ''), c.salt, c.iter)) === c.hash;
    },
    async create(user, pw) {
      const salt = b64(g.crypto.getRandomValues(new Uint8Array(16))), iter = 150000;
      return { user: String(user).trim(), salt, iter, hash: await derive(pw, salt, iter) };
    },
    useLocal(cfg) {
      const e = g.ADMIN_AUTH || null;
      try { localStorage.setItem(LK, JSON.stringify({ cfg, base: e ? e.hash : '' })); } catch (err) { /* diabaikan */ }
    },
    fileText(cfg) {
      return '/* Kredensial dashboard trainer (hanya hash, bukan sandi). Ganti lewat Dashboard > Pengaturan > Akun admin, lalu unggah file hasilnya ke folder js/. */\nwindow.ADMIN_AUTH = ' + JSON.stringify(cfg, null, 2) + ';\n';
    }
  };
  g.AdminAuth = Auth;
})(window);
