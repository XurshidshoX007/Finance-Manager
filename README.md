# 💰 Finance Manager — Telegram moliyaviy boshqaruv tizimi

Production darajasidagi Telegram Finance Manager tizimi. Moliyaviy operatsiyalarni boshqarish, hisobotlar, kreditlar, Excel import/export, PDF export, zaxira nusxalar, navbatlar va boshqalar.

## 🏗 Arxitektura

- **Clean Architecture** — Business logic faqat Service qatlamida
- **Repository Pattern** — Database faqat Repository orqali
- **Dependency Injection** — Barcha dependency'lar constructor orqali
- **SOLID, DRY, KISS** tamoyillari
- **CUID** — ID'lar uchun (UUID emas)
- **Decimal.js** — Pul miqdorlari uchun (float emas)
- **Soft Delete** — Barcha jadvallarda `isArchived`, `archivedAt`

## 🛡 Texnologiyalar

| Qatlam | Texnologiya |
|--------|-------------|
| Backend | Node.js 22+, TypeScript (strict), grammY |
| Database | PostgreSQL, Prisma ORM |
| Cache | Redis 7+ |
| Queue | BullMQ |
| Validation | Zod |
| Logging | Pino |
| Export | ExcelJS, PDFKit |
| Backup | pg_dump, archiver, adm-zip |
| Frontend | React 19, Vite, TailwindCSS, TanStack Query |
| Deploy | Docker, GitHub Actions |
| API Docs | Swagger/OpenAPI 3.0 |

## 📁 Loyiha tuzilishi

```
finance-manager/
├── src/
│   ├── modules/
│   │   ├── auth/          # Autentifikatsiya va RBAC
│   │   ├── users/         # Foydalanuvchilar va Audit Log
│   │   ├── sources/       # Mablag' manbalari
│   │   ├── categories/    # Kategoriyalar
│   │   ├── transactions/  # Tranzaksiyalar (Immutable Ledger)
│   │   ├── credits/       # Kreditlar (Annuitet, Differensial)
│   │   ├── reports/       # Hisobotlar, Dashboard, PDF
│   │   ├── excel/         # Excel Import/Export
│   │   ├── notifications/ # Bildirishnomalar va Worker
│   │   ├── settings/      # Sozlamalar
│   │   ├── backup/        # Zaxira nusxalar (pg_dump/restore)
│   │   └── queue/         # BullMQ navbat boshqaruvi
│   ├── scheduler/         # Cron rejalashtiruvchi
│   ├── shared/
│   │   ├── config/        # Environment validation (Zod)
│   │   ├── database/      # Prisma & Redis
│   │   ├── errors/        # Custom error classes (7 ta)
│   │   ├── logger/        # Pino logger
│   │   ├── middlewares/   # Express middlewares + Swagger
│   │   ├── types/         # Shared types & enums
│   │   └── utils/         # Decimal, Date, Pagination, Helpers
│   ├── api/               # REST API routes
│   ├── tests/             # 56 ta test
│   └── index.ts           # Entry point
├── prisma/                # Prisma schema (14 model) & migrations
├── docker/                # Multi-stage Dockerfile
├── mini-app/              # Telegram Mini App (React 19)
│   ├── src/
│   │   ├── pages/         # Dashboard, Transactions, Sources, Categories, Credits, Reports
│   │   ├── components/    # Layout, Skeleton, ErrorBoundary
│   │   └── services/      # API client
│   └── dist/              # Build output (283KB JS, 18KB CSS)
├── docs/                  # CI/CD, API documentation
└── docker-compose.yml     # PostgreSQL, Redis, App
```

## 🚀 O'rnatish

### 1. Talablar

- Node.js 22+
- PostgreSQL 16+
- Redis 7+

### 2. Klounlash va o'rnatish

```bash
git clone https://github.com/XurshidshoX007/Finance-Manager.git
cd Finance-Manager
npm install
```

### 3. Environment sozlash

```bash
cp .env.example .env
# .env faylini o'zingizga mos ravishda tahrirlang
```

### 4. Database sozlash

```bash
npx prisma migrate dev
npx prisma generate
```

### 5. Ishga tushirish

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### Docker orqali

```bash
docker-compose up -d
```

## 📱 Telegram Bot buyruqlari

| Buyruq | Tavsif |
|--------|--------|
| `/start` | Botni ishga tushirish |
| `/menu` | Bosh menyu |
| `/help` | Yordam |
| `/profile` | Profil ma'lumotlari |
| `/role` | Rol ma'lumotlari |
| `/sources` | Mablag' manbalari |
| `/categories` | Kategoriyalar |
| `/transactions` | Tranzaksiyalar |
| `/credits` | Kreditlar |
| `/reports` | Hisobotlar |
| `/users` | Foydalanuvchilar (Admin) |

## 🔐 Rollar va ruxsatlar (RBAC)

| Ruxsat | Admin | Manager | Employee |
|--------|-------|---------|----------|
| Manbalar CRUD | ✅ | ✅ | 📖 |
| Kategoriyalar CRUD | ✅ | ✅ | 📖 |
| Tranzaksiyalar yaratish | ✅ | ✅ | ✅ |
| Tranzaksiyalar bekor qilish | ✅ | ✅ | ❌ |
| Kreditlar CRUD | ✅ | ✅ | 📖 |
| Hisobotlar | ✅ | ✅ | 📖 |
| Excel Import/Export | ✅ | ✅ | ❌ |
| PDF Export | ✅ | ✅ | ❌ |
| Foydalanuvchilar boshqaruvi | ✅ | ❌ | ❌ |
| Sozlamalar | ✅ | ❌ | ❌ |
| Zaxira nusxalar | ✅ | ❌ | ❌ |

## 📊 Asosiy xususiyatlar

### Kirim/Chiqim
- Kirim va chiqim tranzaksiyalari
- Ichki o'tkazmalar (Double Entry Transfer)
- Immutable Ledger — tranzaksiyalar o'chirilmaydi, faqat bekor qilinadi
- Balans tranzaksiyalardan hisoblanadi
- Ko'p valyuta: UZS, USD, EUR, RUB, GBP, CNY

### Kreditlar
- Annuitet va Differensial kredit turlari
- Avtomatik jadval generatsiyasi
- Muddatidan oldin to'lov
- Qolgan qarzni hisoblash
- Kredit eslatmalari

### Hisobotlar
- Kunlik, haftalik, oylik, yillik
- Profit & Loss, Cash Flow, Balance
- KPI ko'rsatkichlari
- Top kategoriyalar va manbalar
- PDF export (hisobotlar va tranzaksiyalar ro'yxati)

### Excel
- Import: Preview, Validation, Duplicate Check, Mapping
- Export: Tranzaksiyalar, Kreditlar, Jadval
- Shablon generatsiyasi

### PDF Export
- Hisobot PDF (A4, grafik elementlar, rangli)
- Tranzaksiyalar ro'yxati PDF (landscape, jadval)
- O'zbek tilida formatlash

### Zaxira nusxalar (Backup)
- `pg_dump` orqali to'liq SQL dump
- ZIP arxiv (9-darajali siqish)
- Eski nusxalarni avtomatik o'chirish (retention)
- Qayta tiklash (restore) — `psql` orqali
- Ro'yxat olish (list) — barcha zaxira nusxalar

### Navbatlar (Queue)
- BullMQ asosida ishlaydi
- `daily_reminder` — kunlik eslatmalar
- `credit_reminder` — kredit to'lovi eslatmalari
- `backup` — zaxira nusxa yaratish
- Exponential backoff, retry

### Rejalashtiruvchi (Scheduler)
- 03:00 — Kunlik zaxira nusxa
- 08:00 — Kredit to'lovi eslatmalari
- 09:00 — Kunlik eslatmalar
- node-cron asosida

### Bildirishnomalar
- Kunlik eslatmalar
- Kredit to'lovi eslatmalari
- O'qilmagan/oxirgi bildirishnomalar
- Telegram orqali yuborish

### Audit Log
- Barcha operatsiyalar log qilinadi
- Foydalanuvchi, vaqt, o'zgarishlar
- Import, Export, Create, Update, Delete, Cancel

### Telegram Mini App
- React 19 + Vite + TailwindCSS
- 6 ta sahifa: Dashboard, Transactions, Sources, Categories, Credits, Reports
- Skeleton loading, ErrorBoundary
- Responsive dizayn
- TanStack Query bilan server state

## 📡 REST API

### Endpoints

```
# Health
GET  /api/v1/health

# Manbalar
GET  /api/v1/sources                   # Manbalar ro'yxati
POST /api/v1/sources                   # Manba yaratish
GET  /api/v1/sources/:id               # Manba ma'lumotlari
PUT  /api/v1/sources/:id               # Manba yangilash
DELETE /api/v1/sources/:id             # Manba arxivlash

# Kategoriyalar
GET  /api/v1/categories                # Kategoriyalar
POST /api/v1/categories                # Kategoriya yaratish
GET  /api/v1/categories/:id            # Kategoriya ma'lumotlari
PUT  /api/v1/categories/:id            # Kategoriya yangilash
DELETE /api/v1/categories/:id          # Kategoriya arxivlash

# Tranzaksiyalar
GET  /api/v1/transactions              # Tranzaksiyalar
POST /api/v1/transactions              # Tranzaksiya yaratish
POST /api/v1/transactions/transfer     # O'tkazma
POST /api/v1/transactions/:id/cancel   # Tranzaksiyani bekor qilish

# Kreditlar
GET  /api/v1/credits                   # Kreditlar
POST /api/v1/credits                   # Kredit yaratish
GET  /api/v1/credits/:id               # Kredit ma'lumotlari
POST /api/v1/credits/:id/early-payment # Muddatidan oldin to'lov

# Hisobotlar
GET  /api/v1/reports/dashboard         # Dashboard
GET  /api/v1/reports/report            # Hisobot
GET  /api/v1/reports/kpi               # KPI
GET  /api/v1/reports/pdf               # Hisobot PDF export
GET  /api/v1/reports/transactions-pdf  # Tranzaksiyalar PDF export

# Excel
GET  /api/v1/excel/export/transactions # Excel export
GET  /api/v1/excel/export/credits      # Kreditlar export
GET  /api/v1/excel/template            # Import shablon
POST /api/v1/excel/import/preview      # Import preview
POST /api/v1/excel/import              # Import

# Foydalanuvchilar
GET  /api/v1/users                     # Foydalanuvchilar
GET  /api/v1/audit                     # Audit log

# Zaxira nusxalar
POST /api/v1/backup                    # Zaxira nusxa yaratish
GET  /api/v1/backup                    # Zaxira nusxalar ro'yxati
POST /api/v1/backup/restore            # Zaxira nusxadan tiklash

# Navbat
GET  /api/v1/queue/stats               # Navbat statistikasi

# API Docs
GET  /api/v1/docs                      # Swagger UI
```

## 🗄 Database (Prisma)

14 ta model:

| Model | Tavsif |
|-------|--------|
| User | Foydalanuvchilar (Telegram ID, rol, til) |
| Source | Mablag' manbalari (valyuta, balans) |
| CategoryGroup | Kategoriya guruhlari |
| Category | Kategoriyalar (INCOME/EXPENSE) |
| Transaction | Tranzaksiyalar (Immutable Ledger) |
| Credit | Kreditlar (Annuitet/Differensial) |
| CreditSchedule | Kredit to'lov jadvali |
| CreditEarlyPayment | Muddatidan oldin to'lovlar |
| AuditLog | Audit log yozuvlari |
| Notification | Bildirishnomalar |
| UserSetting | Foydalanuvchi sozlamalari |
| ImportProfile | Import profillari |

Barcha jadvallarda: `id`, `createdAt`, `updatedAt`, `archivedAt`, `isArchived`

## 🧪 Test

```bash
npm test              # 56 ta test (6 file)
npm run typecheck     # TypeScript strict mode
npm run build         # Build
```

## 📝 Lint & Format

```bash
npm run lint
npm run format
npm run format:check
```

## 🐳 Docker

```bash
# Barcha xizmatlarni ishga tushirish
docker-compose up -d

# Faqat backend
docker build -f docker/Dockerfile -t finance-manager .
docker run -p 3000:3000 finance-manager
```

## 📄 Litsenziya

MIT
