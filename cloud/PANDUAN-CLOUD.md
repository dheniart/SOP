# Panduan memasang cloud (Google Sheets)

Dengan cloud, soal yang kamu ubah di dashboard otomatis dipakai semua perangkat crew, dan hasil kuis semua crew terkumpul di dashboard. Datanya tersimpan di Google Sheets milikmu. Gratis dan tidak perlu kartu kredit. Sekali pasang, sekitar 10 menit.

## A. Pasang backend (sekali saja)

1. Buka **sheets.new** untuk membuat Google Sheet baru. Beri nama, misalnya `Lengkapi SOP Data`.
2. Di menu atas pilih **Ekstensi (Extensions) → Apps Script**.
3. Hapus semua kode contoh, lalu tempel seluruh isi file **`Code.gs`**.
4. Di baris `var ADMIN_TOKEN = '...'`, ganti isinya dengan token rahasia buatanmu: minimal 12 karakter, acak (campur huruf dan angka). Simpan token ini, nanti dimasukkan ke dashboard. Jangan dibagikan ke crew.
5. Klik ikon **Simpan** (disket).
6. Klik **Deploy (Terapkan) → Deployment baru**. Klik ikon roda gigi di samping "Pilih jenis" dan pilih **Aplikasi web**.
   - **Jalankan sebagai (Execute as):** Saya (akun kamu)
   - **Siapa yang memiliki akses (Who has access):** Siapa saja (Anyone)
7. Klik **Deploy**. Saat Google meminta izin, pilih akunmu. Jika muncul peringatan "Google hasn't verified this app", klik **Advanced → Go to ... (unsafe)** lalu **Allow**. Ini aman karena skrip itu milikmu sendiri.
8. Salin **URL aplikasi web** yang berakhiran `/exec`.

## B. Hubungkan dashboard

1. Buka `admin.html` dan login.
2. Menu **Pengaturan → Sinkronisasi cloud**. Tempel **URL** dan **token** tadi.
3. Klik **Uji koneksi**. Hasil yang benar: "Terhubung dan token benar".
4. Klik **Simpan dan unduh config.js**. Browser mengunduh file `config.js`.
5. Di GitHub, buka folder **`js`**, unggah `config.js` itu (timpa yang lama), lalu **Commit changes**.
6. Tunggu 1 sampai 3 menit sampai GitHub Pages diperbarui. Setelah itu semua perangkat crew memakai cloud.

Badge di pojok atas dashboard menunjukkan status: **Cloud: tersinkron** artinya soal terbaru sudah tersimpan.

## C. Pemakaian sehari-hari

- **Mengubah soal:** cukup tambah, ubah, atau hapus di dashboard. Setiap perubahan otomatis tersimpan ke cloud. Crew mendapat soal terbaru saat membuka halaman kuis.
- **Melihat hasil crew:** menu **Hasil Kuis**, klik **Muat ulang**. Di Google Sheet juga ada tab `Hasil` yang bisa dibuka langsung.
- **Dashboard di perangkat lain (misalnya laptop kedua):** buka `admin.html`, login, lalu isi URL dan token di Pengaturan.

## D. Catatan penting

- **Mengubah kode `Code.gs` kemudian:** simpan, lalu **Deploy → Kelola deployment → ikon pensil → Versi: Versi baru → Deploy**. URL tetap sama.
- **Token** hanya disimpan di browser tempat kamu mengisinya. Siapa pun yang tahu URL bisa membaca bank soal dan mengirim hasil, tetapi hanya pemegang token yang bisa membaca hasil kuis atau mengubah soal.
- Hasil kuis berisi nama dan outlet crew. Jangan bagikan Google Sheet-nya ke orang yang tidak berkepentingan.
- Jika perangkat crew tidak punya koneksi saat kuis selesai, hasil ditahan di perangkat dan dikirim otomatis saat kuis dibuka lagi dengan koneksi.
- Akun Google Workspace (kantor atau sekolah) kadang membatasi akses "Siapa saja". Jika terjadi, gunakan akun Google pribadi.
