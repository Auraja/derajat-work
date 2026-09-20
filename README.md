# Derajat Work

**Personal Work Operating System**

Derajat Work adalah ruang kerja pribadi modular untuk mengelola konteks kerja, pengetahuan, materi, template, skills, dan rancangan orkestrasi. Aplikasi terdiri dari API FastAPI, antarmuka Next.js, dan SQLite persisten. Deployment bawaan sengaja hanya membuka port ke loopback host agar origin tidak langsung terekspos ke jaringan publik.

> **Status AI:** integrasi AI/LLM dan konten hasil generasi belum diimplementasikan. Lima endpoint generasi placeholder tetap tersedia sebagai kontrak API, tetapi semuanya hanya mengembalikan respons `not_implemented`; tidak ada model, provider, API key, atau background worker AI dalam deployment ini.

## Arsitektur

```text
Browser / Cloudflare Tunnel (opsional)
                |
       127.0.0.1:3100
                |
      Next.js frontend :3000
                |
     http://backend:8000
                |
       FastAPI backend :8000
                |
     /data/derajat.db (SQLite)
       named Docker volume
```

- **Frontend** — Next.js pada port container `3000`; melayani UI dan mengakses backend melalui nama service internal `http://backend:8000`.
- **Backend** — FastAPI pada port container `8000`; menangani autentikasi, validasi, operasi data, dan migrasi.
- **Database** — satu berkas SQLite di `/data/derajat.db`, disimpan dalam named volume `derajat_sqlite` (nama dapat diganti lewat `SQLITE_VOLUME_NAME`). Tidak ada container database terpisah.
- **Jaringan host** — hanya frontend yang dipublikasikan ke `127.0.0.1:${FRONTEND_PORT:-3100}`. Semua API, termasuk health check, diakses melalui proxy same-origin frontend; backend tetap internal di jaringan Compose.

## Modul dan route

### Modul produk

1. **Autentikasi dan profil** — login, sesi berbasis cookie, identitas pengguna aktif, logout, dan penggantian password.
2. **Ruang kerja** — membuat, mengubah, membuka, dan menghapus ruang pribadi beserta seluruh isi terkait.
3. **Skills dan orkestrasi** — menyimpan instruksi kerja yang dapat digunakan ulang dan menyusun urutan skills. Eksekusi runtime AI belum tersedia.
4. **Sesi** — membuat, membaca, memperbarui, dan menghapus sesi.
5. **Materi** — mengelola materi dan kontennya.
6. **Template** — mengelola template yang dapat digunakan ulang.
7. **Operasional** — health check, migrasi, backup/restore, dan smoke test.

Route UI utama: `/login`, `/dashboard`, `/kanban`, `/workspaces/[slug]`, seluruh subroute `/workspaces/[slug]/teaching/*`, `/library`, `/templates`, dan `/settings`. Route resource juga menyediakan halaman create/detail/edit. Permintaan API browser memakai path relatif `/api`, bukan hostname Docker `backend` yang tidak dapat di-resolve browser.

### Kontrak Kanban global

`/kanban` adalah satu papan global. Setiap kartu memiliki tepat satu `workspace_id` sebagai assignment, dan konten kartu hanya terlihat oleh anggota workspace assignment tersebut. Kolom adalah metadata workflow yang dimiliki workspace asal: anggota pemilik kolom dapat melihat kolom tanpa melihat kartu yang ditugaskan keluar, sedangkan penerima kartu dapat melihat metadata kolom yang diperlukan untuk menemukan kartu meskipun bukan anggota pemilik kolom. Metadata kolom tidak pernah memberi akses ke konten kartu.

Membuat atau memindahkan kartu memerlukan role `owner`/`admin` pada workspace assignment dan workspace pemilik kolom tujuan. Mengubah atau menghapus kartu memerlukan role `owner`/`admin` pada workspace assignment saat ini. Delegasi lintas workspace memerlukan role `owner`/`admin` pada assignment sumber dan tujuan. Endpoint Kanban per-workspace lama hanya menampilkan kartu yang assignment-nya sama dengan workspace route dan menerapkan ACL assignment yang sama, sehingga endpoint tersebut tetap kompatibel tanpa menjadi jalur bypass. Posisi kartu bersifat global per kolom, deterministik, dan selalu dinormalisasi menjadi rentang kontigu. Penghapusan kolom yang berisi kartu serta penghapusan workspace yang terlibat dalam delegasi lintas workspace ditolak sampai kartu dipindahkan atau dihapus secara eksplisit.

### Kontrak API inti

| Area | Method dan path | Autentikasi | Fungsi |
|---|---|---:|---|
| Health | `GET /api/health` | Tidak | Status kesiapan backend |
| Auth | `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, `POST /api/v1/auth/logout` | Campuran | Membuat, memeriksa, dan mengakhiri sesi cookie |
| User | `PATCH /api/v1/users/me`, `PATCH /api/v1/users/me/password` | Ya | Profil dan password pengguna aktif |
| Workspaces | `GET/POST /api/v1/workspaces`, `GET/PATCH/DELETE /api/v1/workspaces/{id_or_slug}` | Ya | Daftar, detail, pembuatan, perubahan, dan penghapusan workspace yang dapat diakses |
| Skills | `GET/POST /api/v1/workspaces/{id_or_slug}/skills`, `GET/PATCH/DELETE /api/v1/skills/{id}` | Ya | CRUD instruksi skill dalam workspace |
| Orkestrasi | `GET/POST /api/v1/workspaces/{id_or_slug}/orchestrations`, `GET/PATCH/DELETE /api/v1/orchestrations/{id}` | Ya | CRUD urutan skill dalam workspace |
| Teaching sessions | `GET/POST /api/v1/workspaces/{workspace_id}/teaching/sessions`, `GET/PATCH/DELETE /api/v1/teaching/sessions/{id}` | Ya | CRUD sesi Teaching dalam workspace |
| Materials | `GET/POST /api/v1/materials`, `GET/PATCH/DELETE /api/v1/materials/{id}` | Ya | CRUD materi terkait workspace |
| Templates | `GET/POST /api/v1/templates`, `GET/PATCH/DELETE /api/v1/templates/{id}` | Ya | CRUD template terkait workspace |

Workspace seed `bisa-ai` memuat modul **Teaching**, **Projects**, dan **Files**. Alur Teaching mengambil workspace melalui `GET /api/v1/workspaces`, memilih item dengan `slug: "bisa-ai"`, lalu memakai `id` tersebut pada collection route sesi. Detail sesi tidak memakai prefix workspace.

Seed workspace hanya dijalankan sekali dan ditandai di database. Workspace bawaan yang sengaja dihapus tidak dibuat ulang saat aplikasi dimulai kembali.

Kontrak umum:

- request dan response data memakai JSON, kecuali endpoint yang memang mengembalikan `204 No Content`;
- login menerima `email` dan `password`, lalu autentikasi berikutnya menggunakan cookie HTTP-only;
- route terlindungi harus menolak request tanpa sesi valid dengan `401` atau `403`;
- create mengembalikan objek yang memuat `id`; endpoint item memakai `/{id}`;
- error validasi menggunakan status `422`, konflik data `409` bila relevan, dan objek yang tidak ditemukan `404`.

Dokumentasi OpenAPI backend tersedia melalui `http://127.0.0.1:${FRONTEND_PORT:-3100}/api/docs` saat dokumentasi FastAPI diaktifkan, atau langsung dari dalam jaringan Compose.

## Prasyarat

Untuk pengembangan lokal:

- Python sesuai versi yang ditentukan backend;
- [`uv`](https://docs.astral.sh/uv/);
- Node.js dan npm sesuai versi yang ditentukan frontend.

Untuk deployment container:

- Docker Engine;
- Docker Compose v2 (`docker compose`).

## Konfigurasi environment

Buat file environment lokal:

```bash
cp .env.example .env
openssl rand -hex 32
```

Masukkan hasil perintah kedua sebagai `APP_SECRET_KEY`. Jangan menyalin placeholder dan jangan commit `.env`.

Variabel penting:

| Variabel | Keterangan |
|---|---|
| `APP_SECRET_KEY` | Wajib; secret acak untuk signing/session. Gunakan nilai berbeda per deployment. |
| `APP_NAME`, `APP_VERSION`, `APP_ENV` | Identitas dan mode aplikasi. |
| `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` | Bootstrap admin opsional; lihat bagian administrator. |
| `COOKIE_SECURE` | `false` untuk HTTP loopback; `true` ketika request aplikasi benar-benar diterima sebagai HTTPS melalui proxy tepercaya. |
| `CORS_ORIGINS` | Daftar origin browser yang diizinkan, dipisahkan koma. Jangan gunakan wildcard untuk deployment berkredensial. |
| `FRONTEND_PORT` | Port host loopback untuk UI dan API same-origin; default `3100`. |
| `NEXT_PUBLIC_API_BASE_URL` | Prefix API dari sisi browser; default `/api/v1`. Compose menetapkan `BACKEND_INTERNAL_URL=http://backend:8000` untuk komunikasi server-side. |
| `DATABASE_URL` | Default `sqlite:////data/derajat.db`; path absolut di container backend. |
| `SQLITE_VOLUME_NAME` | Nama volume persisten; default `derajat_sqlite`. |

Setelah perubahan origin/port, selaraskan `CORS_ORIGINS`. Hindari memasukkan password ke history shell; gunakan prompt interaktif atau environment sementara yang dibersihkan setelah dipakai.

## Pengembangan backend lokal

Dari root repository:

```bash
cd backend
uv venv .venv
source .venv/bin/activate
uv pip install -e '.[dev]'
```

Jika backend menyediakan `uv.lock`, gunakan `uv sync --dev` agar versi dependency sama dengan lockfile. Atur database lokal terpisah agar tidak menyentuh volume produksi, lalu jalankan migrasi dan server:

```bash
export DATABASE_URL='sqlite:///./derajat-dev.db'
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Backend lokal dapat diperiksa di `http://127.0.0.1:8000/api/health` dan dokumentasi FastAPI di `/docs`.

## Pengembangan frontend lokal

Pada terminal lain:

```bash
cd frontend
npm install
BACKEND_INTERNAL_URL=http://127.0.0.1:8000 NEXT_PUBLIC_API_BASE_URL=/api/v1 npm run dev
```

Buka URL yang ditampilkan Next.js (umumnya `http://localhost:3000`). Untuk instalasi reproducible di CI gunakan `npm ci` ketika `package-lock.json` sudah tersedia.

Build produksi frontend:

```bash
cd frontend
npm ci
NEXT_PUBLIC_API_BASE_URL=/api/v1 npm run build
npm run start
```

`NEXT_PUBLIC_*` dapat di-inline saat build oleh Next.js. Jika nilainya diubah, build ulang image frontend; mengganti environment runtime saja belum tentu mengubah bundle browser.

## Docker Compose

Validasi konfigurasi terlebih dahulu:

```bash
cp .env.example .env                 # hanya jika .env belum dibuat
# isi APP_SECRET_KEY yang aman

docker compose config --quiet
docker compose build
docker compose up -d
docker compose ps
```

Compose minimal menjalankan dua service:

- `frontend`, bergantung pada kondisi `backend` sehat;
- `backend`, memasang named volume pada `/data`.

Keduanya memakai `restart: unless-stopped` dan healthcheck. Tidak ada port bind `0.0.0.0`. Akses lokal:

- UI: `http://127.0.0.1:3100` (atau `FRONTEND_PORT`);
- API health melalui frontend: `http://127.0.0.1:3100/api/health`.

Perintah harian:

```bash
docker compose ps
docker compose logs --tail=100 frontend backend
docker compose restart frontend       # restart hanya service yang diperlukan
docker compose stop                    # hentikan stack tanpa menghapus volume
docker compose up -d
```

Jangan gunakan `docker compose down -v` kecuali memang bermaksud menghapus database secara permanen.

## Administrator pertama

Cara utama adalah CLI interaktif di container backend:

```bash
docker compose exec backend python -m app.cli create-admin
```

Masukkan email, nama, dan password melalui prompt. Input password tidak seharusnya tampil di terminal.

Untuk otomasi, lihat bantuan CLI yang terpasang sebelum menggunakan flag:

```bash
docker compose exec backend python -m app.cli create-admin --help
```

Jika implementasi backend mendukung bootstrap environment, isi sementara `ADMIN_EMAIL`, `ADMIN_NAME`, dan `ADMIN_PASSWORD`, lalu recreate **hanya backend**:

```bash
docker compose up -d --no-deps --force-recreate backend
```

Bootstrap harus bersifat satu kali: hanya membuat akun jika belum ada dan tidak menimpa password akun yang sudah ada. Setelah sukses, kosongkan `ADMIN_PASSWORD` dari `.env`, recreate backend lagi, dan jangan menyimpan password plaintext. Jika backend tidak mendukung bootstrap env, gunakan CLI interaktif.

### Mengganti password

Gunakan subcommand interaktif backend bila tersedia:

```bash
docker compose exec backend python -m app.cli change-password
```

Periksa nama/opsi yang benar dengan `python -m app.cli --help`. Setelah mengganti password, logout dari sesi lama dan login ulang. Implementasi yang aman menginvalidasi sesi lama; verifikasi perilaku tersebut sebelum deployment sensitif.

## Migrasi database

Jalankan migrasi dari container/backend environment yang memakai `DATABASE_URL` target:

```bash
# Naik ke revisi terkini
docker compose exec backend alembic upgrade head

# Lihat revisi aktif dan riwayat
docker compose exec backend alembic current
docker compose exec backend alembic history

# Turun tepat satu revisi (backup dahulu)
docker compose exec backend alembic downgrade -1

# Buat revisi baru pada environment pengembangan
docker compose exec backend alembic revision --autogenerate -m "jelaskan perubahan"
```

Review file revisi hasil autogenerate sebelum dijalankan. Jangan membuat revisi baru langsung pada host produksi dan jangan downgrade tanpa backup.

### Seed dan bootstrap

Migrasi skema dan seed data adalah dua hal berbeda. `alembic upgrade head` hanya boleh mengubah skema/data migrasi yang eksplisit; jangan mengandalkannya untuk membuat kredensial contoh. Deployment tidak membutuhkan data dummy. Admin pertama dibuat melalui CLI atau bootstrap environment satu kali bila didukung. Jika backend menyediakan perintah `seed`, baca `python -m app.cli --help` dan jalankan hanya pada development/test—seed harus idempotent dan tidak boleh mengganti admin yang ada.

## Persistensi SQLite

`DATABASE_URL=sqlite:////data/derajat.db` menunjuk ke `/data/derajat.db` **di dalam container**, bukan `./data` pada repository. Mount `derajat_sqlite:/data` membuat berkas bertahan ketika container backend dibuat ulang. Mengubah `SQLITE_VOLUME_NAME` memilih volume yang berbeda dan dapat terlihat seperti kehilangan data, padahal aplikasi membuka database baru.

Lihat volume yang efektif tanpa mencetak secret:

```bash
docker compose config --volumes
docker volume inspect "${SQLITE_VOLUME_NAME:-derajat_sqlite}"
```

### Backup online dengan SQLite backup API

Metode ini tidak perlu menghentikan backend dan menghasilkan snapshot SQLite konsisten:

```bash
mkdir -p backups
docker compose exec -T backend python -c \
  "import sqlite3; s=sqlite3.connect('/data/derajat.db'); d=sqlite3.connect('/tmp/derajat-backup.db'); s.backup(d); d.close(); s.close()"
docker compose cp backend:/tmp/derajat-backup.db \
  "./backups/derajat-$(date -u +%Y%m%dT%H%M%SZ).db"
docker compose exec -T backend rm -f /tmp/derajat-backup.db
```

### Backup dengan penghentian singkat

Hentikan **hanya backend**; frontend boleh tetap hidup tetapi request API sementara gagal:

```bash
mkdir -p backups
docker compose stop backend
docker run --rm \
  -v "${SQLITE_VOLUME_NAME:-derajat_sqlite}:/data:ro" \
  -v "$PWD/backups:/backup" alpine \
  sh -c 'cp /data/derajat.db /backup/derajat-stopped.db'
docker compose start backend
```

Tambahkan timestamp ke nama file sesuai prosedur operasional. Pastikan backend sehat lagi setelah start.

### Restore

Restore menimpa database aktif. Verifikasi file backup dan ambil backup tambahan sebelum melanjutkan:

```bash
test -s ./backups/derajat-restore.db
docker compose stop backend
docker run --rm \
  -v "${SQLITE_VOLUME_NAME:-derajat_sqlite}:/data" \
  -v "$PWD/backups:/backup:ro" alpine \
  sh -c 'cp /backup/derajat-restore.db /data/derajat.db && rm -f /data/derajat.db-wal /data/derajat.db-shm'
docker compose start backend
docker compose exec backend alembic upgrade head
curl -fsS "http://127.0.0.1:${FRONTEND_PORT:-3100}/api/health"
```

Jangan menjalankan restore saat backend masih menulis database. Perintah di atas tidak menghentikan atau menghapus service/volume lain.

## Cloudflare Tunnel (opsional)

Compose tidak mengubah konfigurasi Cloudflare. Pertahankan port loopback, lalu arahkan service tunnel ke:

```text
http://localhost:${FRONTEND_PORT}
```

Dengan default `.env`, origin-nya adalah `http://localhost:3100`. Tambahkan hostname publik HTTPS yang sebenarnya ke `CORS_ORIGINS` dan gunakan `COOKIE_SECURE=true` untuk akses publik HTTPS. Backend tidak memiliki host port dan tidak perlu diekspos melalui tunnel. Konfigurasi DNS, kredensial tunnel, dan policy Access dikelola di luar repository ini; tidak ada perubahan otomatis.

## Health check dan verifikasi operasional

Pemeriksaan cepat:

```bash
docker compose ps
curl -fsS "http://127.0.0.1:${FRONTEND_PORT:-3100}/api/health"
curl -fsS -o /dev/null "http://127.0.0.1:${FRONTEND_PORT:-3100}/"
```

Smoke test memeriksa frontend, health backend, login, route terlindungi, lima kontrak placeholder AI, CRUD session/material/template, dan logout. Record sementara dihapus dan cleanup tambahan dilakukan best-effort jika test terputus. Script menggunakan cookie jar dan tidak mencetak token/password.

```bash
TEST_ADMIN_EMAIL='admin@example.com' \
TEST_ADMIN_PASSWORD='masukkan-secara-aman' \
./scripts/smoke.sh
```

Jangan gunakan kredensial produksi dalam history shell. Lebih aman ekspor dari secret manager/session shell, jalankan script, lalu `unset TEST_ADMIN_EMAIL TEST_ADMIN_PASSWORD`. Jika schema create memerlukan field tambahan, berikan JSON melalui `SMOKE_SESSION_CREATE_JSON`, `SMOKE_MATERIAL_CREATE_JSON`, atau `SMOKE_TEMPLATE_CREATE_JSON`; path endpoint juga dapat diganti melalui variabel `*_PATH` di script.

## Test, lint, typecheck, dan build

Jalankan command yang tersedia di manifest masing-masing package. Baseline yang diharapkan:

```bash
# Backend
cd backend
uv sync --dev
uv run pytest
uv run ruff check .
uv run alembic check

# Frontend
cd ../frontend
npm ci
npm run lint
npm run typecheck
npm test
npm run build

# Root/deployment
cd ..
bash -n scripts/smoke.sh
docker compose config --quiet
```

Jika manifest tidak mendefinisikan salah satu script (misalnya `typecheck` atau `test`), jangan menganggapnya lulus: tambahkan script di package terkait atau dokumentasikan pemeriksaan penggantinya di CI.

## Catatan keamanan

- Jangan commit `.env`, database, backup, cookie jar, atau kredensial tunnel.
- Gunakan `APP_SECRET_KEY` acak yang panjang dan rotasi dengan rencana invalidasi sesi.
- Gunakan password admin unik; hapus `ADMIN_PASSWORD` bootstrap setelah akun dibuat.
- Cookie sesi harus `HttpOnly`, `SameSite` sesuai alur, dan `Secure` pada HTTPS.
- Batasi CORS pada origin eksplisit. CORS bukan mekanisme autentikasi.
- Port host tetap bind ke `127.0.0.1`; gunakan reverse proxy/tunnel terkontrol untuk publikasi.
- Jalankan migrasi dan backup sebelum upgrade image. Uji restore secara berkala.
- Jangan log password, cookie, token, atau request body autentikasi.
- Terapkan rate limiting/lockout login dan batas ukuran request di deployment publik.
- Perbarui dependency dan image base secara berkala, lalu jalankan test dan smoke test.
- Karena SQLite adalah single-file database, satu backend writer adalah konfigurasi aman default; jangan menaikkan replica backend tanpa meninjau strategi database/locking.

## Troubleshooting

### Compose menolak `APP_SECRET_KEY`

Buat `.env` dari `.env.example` dan ganti placeholder dengan secret acak. Compose sengaja gagal cepat bila variabel wajib tidak ada.

### Backend tidak sehat

```bash
docker compose ps
docker compose logs --tail=200 backend
docker compose exec backend python -c "import os; print(bool(os.getenv('APP_SECRET_KEY')), os.getenv('DATABASE_URL', '').startswith('sqlite:'))"
```

Perintah terakhir hanya menampilkan keberadaan/jenis konfigurasi, bukan nilainya. Periksa migrasi dan izin tulis `/data`.

### Frontend terus menunggu backend

`frontend` baru dimulai setelah healthcheck backend lulus. Periksa `/api/health`, log backend, dan apakah image backend memiliki Python (dipakai healthcheck). Jangan menghapus dependency health hanya untuk menyembunyikan kegagalan startup.

### Browser mendapat CORS atau cookie login tidak tersimpan

Pastikan origin browser persis ada di `CORS_ORIGINS`, termasuk skema dan port. Untuk HTTP lokal gunakan `COOKIE_SECURE=false`; untuk hostname HTTPS publik gunakan cookie secure dan pastikan trusted proxy/protocol dikonfigurasi secara sempit. Periksa DevTools tanpa menyalin nilai cookie ke tiket/log.

### API dari frontend gagal tetapi backend sehat

Di dalam container, frontend harus memanggil `http://backend:8000`. Di browser, gunakan path relatif `/api`; browser tidak mengenal hostname Docker `backend` dan backend sengaja tidak memiliki host port.

### Data tampak hilang setelah recreate

Bandingkan `SQLITE_VOLUME_NAME`, `DATABASE_URL`, dan output `docker compose config --volumes`. Jangan membuat volume baru dengan nama project berbeda tanpa memigrasikan database. Jangan jalankan `down -v`.

### Migrasi gagal atau database terkunci

Ambil backup, hentikan hanya backend, pastikan tidak ada proses lain yang membuka volume, lalu jalankan migrasi sekali. Jangan menghapus file `-wal`/`-shm` dari database aktif; penghapusan sidecar hanya aman dalam prosedur restore ketika backend berhenti.

### Smoke test gagal pada payload create

Lihat OpenAPI `/docs` untuk field wajib, lalu set payload override JSON tanpa mengubah script, misalnya:

```bash
export SMOKE_MATERIAL_CREATE_JSON='{"title":"Smoke","content":"uji","required_field":"value"}'
./scripts/smoke.sh
```

Script sengaja gagal pada status non-2xx dan tidak mencetak response body, karena response autentikasi dapat berisi informasi sensitif. Gunakan log backend yang sudah disanitasi untuk diagnosis.
