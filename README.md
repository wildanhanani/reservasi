# Reservasi Online Restoran

Sistem reservasi online full-stack untuk restoran. Frontend memakai Next.js, Tailwind CSS, dan komponen shadcn/ui. Backend memakai Node.js, Fastify, Prisma, dan PostgreSQL.

## Fitur Utama

- 3 role: Super Admin, Admin Resto, Customer.
- Link booking dari WhatsApp, Instagram, atau direct link.
- Form identitas customer, kontak person, tanggal, jam, jumlah tamu, dan catatan.
- Cek ketersediaan slot berdasarkan kapasitas dan reservasi aktif.
- Pre-order menu dengan harga dan total otomatis.
- Ringkasan transaksi dengan opsi bayar penuh atau DP sesuai pengaturan resto.
- Metode pembayaran QRIS, transfer bank, atau cash.
- Receipt berisi kode reservasi, status pembayaran, metode bayar, detail pesanan, dan bisa di-download lewat print browser.
- Notifikasi WhatsApp mock ke admin saat pembayaran masuk.
- Notifikasi WhatsApp mock ke customer setelah admin menyetujui pembayaran.
- Dashboard admin untuk melihat antrian konfirmasi, mengatur DP, kapasitas, slot, dan menu.
- Endpoint super admin untuk membuat restoran dan admin resto.

## Struktur

```txt
apps/web        Next.js customer flow, receipt, dashboard admin
apps/api        Fastify REST API
packages/db     Prisma schema, client, dan seed
```

## Menjalankan Lokal

1. Install dependency:

```bash
npm install
```

2. Salin env:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
cp packages/db/.env.example packages/db/.env
```

3. Jalankan PostgreSQL:

```bash
docker compose up -d
```

4. Generate Prisma, migrate, dan seed:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

5. Jalankan aplikasi:

```bash
npm run dev
```

Frontend: `http://localhost:3000`
Backend: `http://localhost:4000/health`
PostgreSQL: `localhost:5433`
Dashboard admin: `http://localhost:3000/admin`

## Akun Seed

- Super admin: `superadmin@reservasi.local`
- Admin resto: `admin@terasrempah.local`
- Password dev: `dev-password`

Autentikasi belum dipasang supaya scope awal fokus pada alur reservasi end-to-end. Field role, user, dan admin profile sudah tersedia di database untuk integrasi login berikutnya.

## Alur Customer

1. Customer dari WhatsApp atau Instagram membuka link booking.
2. Customer mengisi identitas, nomor, kontak person, tanggal, jam, jumlah tamu, dan catatan.
3. Sistem mengecek slot tersedia.
4. Customer memilih menu.
5. Customer melihat ringkasan, memilih bayar penuh atau DP, lalu memilih QRIS, transfer, atau cash.
6. Customer menyelesaikan pembayaran sesuai instruksi.
7. Sistem membuat receipt dan kode reservasi.
8. Admin resto menerima notifikasi WhatsApp mock untuk mengecek pembayaran.
9. Admin menyetujui pembayaran di dashboard.
10. Sistem mengirim notifikasi WhatsApp mock ke customer dengan link receipt.

## Endpoint Penting

### Public

- `GET /public/restaurants/:slug`
- `POST /public/restaurants/:slug/availability`
- `POST /public/restaurants/:slug/reservations`
- `PATCH /public/reservations/:code/menu`
- `PATCH /public/reservations/:code/payment`
- `POST /public/reservations/:code/submit-payment`
- `GET /public/reservations/:code`

### Admin Resto

- `GET /admin/restaurants/:restaurantId/dashboard`
- `PATCH /admin/restaurants/:restaurantId/settings`
- `POST /admin/restaurants/:restaurantId/slots`
- `POST /admin/restaurants/:restaurantId/menu`
- `GET /admin/restaurants/:restaurantId/reservations`
- `POST /admin/reservations/:reservationId/approve-payment`
- `POST /admin/reservations/:reservationId/reject-payment`

### Super Admin

- `GET /super-admin/restaurants`
- `POST /super-admin/restaurants`

## Integrasi WhatsApp

Saat ini `WA_PROVIDER=mock`, jadi pesan dicetak ke log backend. Untuk produksi, tambahkan adapter provider di:

```txt
apps/api/src/services/whatsapp.ts
```

Provider yang umum dipakai: Meta WhatsApp Cloud API, Twilio, Fonnte, Wablas, atau Qontak.

## Catatan Produksi

Sebelum go-live, tambahkan:

- autentikasi dan authorization per role;
- upload bukti pembayaran ke object storage;
- gateway pembayaran QRIS dinamis;
- webhook pembayaran otomatis;
- rate limit dan audit log admin;
- policy pembatalan dan refund;
- timezone konsisten per restoran.
