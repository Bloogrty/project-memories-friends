# Project Memories

Album foto bersama berbasis web, khusus HP. Tamu membuka satu link, mengambil foto atau video pendek dengan kamera di dalam aplikasi, dan semua orang yang punya link melihat galeri yang sama secara langsung. Foto disimpan di Synology NAS lewat WebDAV. Seluruh kode berjalan di Vercel; NAS hanya menjadi tempat penyimpanan.

Satu kode yang sama bisa dipakai untuk dua cara:

| Mode | Untuk | Link |
|---|---|---|
| `daily` (default) | Teman-teman: album baru setiap hari, ditutup tengah malam | `/` membuka album hari ini (`/d/YYYY-MM-DD`) |
| `event` | Satu acara, misalnya pernikahan, dengan jam mulai dan selesai | `/` membuka album acara (`/d/<EVENT_CODE>`) |

Semua setting (mode, kuota, branding, bahasa, Live Wall, kompresi foto) diatur lewat environment variables. Daftar lengkap beserta penjelasannya ada di [`.env.example`](.env.example).

## Menjalankan di laptop

```bash
npm install
cp .env.example .env.local   # lalu isi ADMIN_SECRET
npm run dev                  # http://localhost:3000
npm run dev:phone            # sama, tapi bisa dibuka dari HP lewat Wi-Fi (HTTPS lokal)
npm run build                # harus lulus sebelum push
npm run lint
```

Tanpa NAS, foto disimpan di folder `.local-storage` (`STORAGE_DRIVER=local`). Langkah setup NAS, Tailscale Funnel, dan Vercel ada di [`docs/SETUP.md`](docs/SETUP.md).

## Halaman

- `/d/<kode>`: halaman tamu (kamera, video, galeri).
- `/wall`: Live Wall, slideshow layar penuh untuk proyektor atau TV. Hanya ada kalau `FEATURE_LIVE_WALL=true`.
- `/admin`: tutup album lebih awal atau hapus foto. Butuh `ADMIN_SECRET`.

## Cara clone untuk event baru

Contoh di bawah untuk pernikahan. Kodenya tidak perlu diubah: cukup deployment baru dengan env yang berbeda.

### 1. Buat deployment baru

1. Di Vercel, buat project baru dari repo yang sama (**Add New > Project**, pilih repo ini). Setiap event punya project dan URL `*.vercel.app` sendiri, jadi album teman-teman tidak terganggu.
2. Isi environment variables (langkah 2), lalu deploy.
3. Di **Settings > Functions**, pilih region **Singapore (sin1)** supaya dekat dengan NAS, lalu redeploy.

### 2. Environment variables

**Wajib diganti:**

| Variabel | Contoh | Keterangan |
|---|---|---|
| `SESSION_MODE` | `event` | Satu album dengan jam mulai dan selesai. |
| `EVENT_CODE` | `andi-sari` | Bagian dari link (`/d/andi-sari`) sekaligus nama folder di NAS. Hanya huruf kecil, angka, dan tanda `-`. Jangan berbentuk tanggal, supaya tidak bentrok dengan folder harian teman-teman. |
| `EVENT_START` | `2026-12-20T16:00` | Mulai bisa upload. Tanpa zona waktu berarti WIB (`APP_TIMEZONE`). |
| `EVENT_END` | `2026-12-20T23:59` | Upload ditutup. Galeri tetap bisa dilihat setelahnya. |
| `APP_TITLE` | `Pernikahan Andi & Sari` | Judul di halaman dan tab browser. |
| `ADMIN_SECRET` | *(acak, 16+ karakter)* | Buat yang baru, jangan pakai ulang punya teman-teman. |
| `WEBDAV_URL`, `WEBDAV_USERNAME`, `WEBDAV_PASSWORD`, `WEBDAV_ROOT` | | Boleh sama dengan deployment teman-teman: foto acara masuk folder `<WEBDAV_ROOT>/<EVENT_CODE>/`. Kalau ingin terpisah total, buat shared folder dan user NAS baru (lihat `docs/SETUP.md`). |

**Disarankan:**

| Variabel | Contoh | Keterangan |
|---|---|---|
| `UI_LANGUAGE` | `id` | Semua teks tamu dalam Bahasa Indonesia. |
| `APP_SUBTITLE` | `Sabtu, 20 Desember 2026 · Jakarta` | Baris di bawah judul. |
| `THEME_PRIMARY` | `#2f6f5e` | Warna tombol. Warna lain dihitung otomatis. |
| `LOGO_URL`, `COVER_IMAGE_URL` | `/wedding/logo.png` | Taruh file di `public/wedding/`, atau pakai link `https://`. |
| `MAX_PHOTOS_PER_PERSON` | `50` | Jatah foto per tamu untuk seluruh acara (default 30). |
| `MAX_VIDEOS_PER_PERSON` | `5` | `0` mematikan video. |
| `EVENT_NOT_STARTED_TEXT` | `Sampai jumpa pukul 16.00!` | Pengganti pesan sebelum acara mulai. |
| `EVENT_ENDED_TEXT` | `Terima kasih sudah datang!` | Pengganti pesan setelah acara selesai. |
| `GALLERY_AFTER_CLOSE` | `readonly` | Default di mode event: galeri tetap terlihat. `hidden` untuk menyembunyikan. |

**Live Wall (untuk layar di venue):**

| Variabel | Contoh | Keterangan |
|---|---|---|
| `FEATURE_LIVE_WALL` | `true` | Mengaktifkan `/wall`. |
| `LIVE_WALL_KEY` | `kunci-rahasia` | Opsional. Wall lalu dibuka lewat `/wall?key=kunci-rahasia`. |
| `LIVE_WALL_INTERVAL` | `6` | Detik per foto. |
| `LIVE_WALL_MUSIC_URLS` | `/music/lagu1.mp3,/music/lagu2.mp3` | Opsional. Taruh MP3 di `public/music/`. Wall menampilkan tombol **Mulai** yang harus diklik sekali, karena browser hanya mengizinkan suara setelah ada klik. |
| `LIVE_WALL_VIDEO_SOUND` | `false` | `true` = suara video tamu ikut terdengar, dan musik otomatis mengecil. |

Contoh lengkap:

```env
SESSION_MODE=event
EVENT_CODE=andi-sari
EVENT_START=2026-12-20T16:00
EVENT_END=2026-12-20T23:59
APP_TITLE=Pernikahan Andi & Sari
APP_SUBTITLE=Sabtu, 20 Desember 2026 · Jakarta
UI_LANGUAGE=id
THEME_PRIMARY=#2f6f5e
MAX_PHOTOS_PER_PERSON=50
FEATURE_LIVE_WALL=true
LIVE_WALL_KEY=kunci-rahasia
ADMIN_SECRET=...
WEBDAV_URL=...
WEBDAV_USERNAME=...
WEBDAV_PASSWORD=...
```

Setelah mengubah env di Vercel, selalu **redeploy**: perubahan baru berlaku di deployment berikutnya. Kalau ada nilai yang salah, misalnya `EVENT_END` lebih awal dari `EVENT_START`, app menolak start dan log Vercel menyebut nama variabelnya.

### 3. Uji sebelum hari H

1. Buka link deployment. Halaman harus menampilkan judul acara dan pesan "Acara belum dimulai".
2. Untuk mencoba upload, sementara ganti `EVENT_START` ke waktu yang sudah lewat, lalu redeploy. Ambil beberapa foto dari HP, lalu cek muncul di galeri, di File Station (folder `<EVENT_CODE>`), dan di `/wall`.
3. Hapus foto percobaan lewat `/admin` (kode album = `EVENT_CODE`), kembalikan `EVENT_START`, lalu redeploy.

### 4. Hari H

- Bagikan link utama (`https://<project>.vercel.app/`). Link ini langsung membuka album acara, jadi bisa dijadikan QR code.
- Buka `/wall` (dengan `?key=...` kalau dipakai) di laptop yang tersambung ke proyektor atau TV. Klik **Mulai** atau klik dua kali untuk layar penuh. Wall meminta layar tetap menyala (didukung Chrome dan Edge), tapi tetap matikan sleep/screensaver di laptop.
