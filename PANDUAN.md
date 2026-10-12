# RuangKinerja Cloud — paket integrasi frontend

## Konfigurasi Anda
Project URL yang diterima berakhiran `/rest/v1/`. Di `config.js`, gunakan base project URL tanpa `/rest/v1/`, misalnya `https://PROJECT_REF.supabase.co`. Masukkan publishable key yang Anda berikan ke file lokal `config.js` sesuai petunjuk. Jangan pernah menaruh service_role/secret key di frontend.

## 1. Jalankan skema database
1. Buka Supabase → SQL Editor → New query.
2. Salin seluruh isi `supabase-schema.sql`, lalu klik Run.
3. Pastikan tidak ada error.

## 2. Konfigurasikan login Google
1. Supabase → Authentication → Providers → Google → Enable.
2. Ikuti petunjuk Supabase untuk membuat OAuth Client ID dan Client Secret di https://console.cloud.google.com/.
3. Tambahkan callback URL Supabase yang ditampilkan di pengaturan Google provider ke Authorized redirect URIs di Google Cloud.
4. Supabase → Authentication → URL Configuration: tambahkan URL localhost dan URL Cloudflare Pages sebagai Redirect URLs setelah URL hosting dibuat.

## 3. Bootstrap admin (wajib)
1. Jalankan website lokal, lalu login dengan Google menggunakan satriabimauin@gmail.com.
2. Di Supabase → SQL Editor jalankan query admin di bagian akhir `supabase-schema.sql`. Query tersebut hanya mengangkat akun yang sudah ada di `auth.users`.
3. Muat ulang website. Pastikan profil Anda menampilkan dashboard admin.
4. Akun Google lain otomatis dibuat sebagai `pending`; setujui melalui dashboard admin.

## 4. Jalankan secara lokal
Buka terminal di folder ini dan jalankan server statis, misalnya:
`python -m http.server 8000`
Lalu buka `http://localhost:8000`. Jangan membuka index.html dengan file:// karena OAuth redirect perlu origin HTTP. Tambahkan `http://localhost:8000` di Supabase Redirect URLs.

## 5. Hosting gratis dengan Cloudflare Pages
1. Unggah folder ini ke repositori GitHub (jangan commit config.js berisi key jika repositori publik; lebih aman isi config.js hanya di salinan deployment yang terkontrol atau gunakan build-time environment variable dengan build setup).
2. Cloudflare Pages → Create project → Connect to Git → pilih repo.
3. Untuk static site, build command kosong dan output directory folder yang berisi `index.html`.
4. Tambahkan URL `https://nama.pages.dev` di Supabase Authentication Redirect URLs.
5. Pastikan file `config.js` di deployment berisi Project URL base dan publishable key.

## Catatan penting dan uji keamanan
- Frontend memakai Supabase JS v2 CDN; koneksi memerlukan internet.
- Database RLS yang ada dalam SQL menjadi lapisan keamanan utama. Koordinator tidak punya policy UPDATE/DELETE pada tabel evaluations.
- Akun pending tidak bisa membaca karyawan atau mengirim penilaian.
- Koordinator hanya dapat membaca karyawan yang ditugaskan; penilaian mereka sendiri yang ditugaskan.
- Admin dapat menyetujui akun, membuat karyawan, mengatur penugasan, serta mengedit/menghapus penilaian.
- Uji dengan akun admin dan akun koordinator terpisah sebelum memasukkan data nyata. Paket ini belum diaudit keamanan independen.
