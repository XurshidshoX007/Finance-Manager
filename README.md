# 💰 Finance Manager — Telegram moliyaviy boshqaruv tizimi

Production darajasidagi Telegram Finance Manager tizimi. Moliyaviy operatsiyalarni boshqarish, hisobotlar, kreditlar, Excel import/export va boshqalar.

## 🏗 Arxitektura

- **Clean Architecture** — Business logic faqat Service qatlamida
- **Repository Pattern** — Database faqat Repository orqali
- **Dependency Injection** — Barcha dependency'lar constructor orqali
- **SOLID, DRY, KISS** tamoyillari

##  Texnologiyalar

| Qatlam | Texnologiya |
|--------|-------------|
| Backend | Node.js 22+, TypeScript (strict), grammY |
| Database | PostgreSQL, Prisma ORM |
| Cache | Redis |
| Queue | BullMQ |
| Validation | Zod |
| Logging | Pino |
| Export | ExcelJS, PDFKit |
| Frontend | React 19, Vite, TailwindCSS |
| Deploy | Docker, Railway, GitHub Actions |

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
│   │   ├── reports/       # Hisobotlar va Dashboard
│   │   ├── excel/         # Excel Import/Export
│   │   ├── notifications/ # Bildirishnomalar
│   │   └── settings/      # Sozlamalar
│   ├── shared/
│   │   ├── config/        # Environment validation
│   │   ├── database/      # Prisma & Redis
│   │   ├── errors/        # Custom error classes
│   │   ├── logger/        # Pino logger
│   │   ├── middlewares/   # Express middlewares
│   │   ├── types/         # Shared types & enums
│   │   └── utils/         # Utility functions
│   ├── api/               # REST API routes
│   └── index.ts           # Entry point
├── prisma/                # Prisma schema & migrations
├── docker/                # Dockerfile
├── mini-app/              # Telegram Mini App (React)
└── docs/                  # Documentation
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

## 🔐 Rollar va ruxsatlar

| Ruxsat | Admin | Manager | Employee |
|--------|-------|---------|----------|
| Manbalar CRUD | ✅ | ✅ | 📖 |
| Kategoriyalar CRUD | ✅ | ✅ | 📖 |
| Tranzaksiyalar yaratish | ✅ | ✅ | ✅ |
| Tranzaksiyalar bekor qilish | ✅ | ✅ | ❌ |
| Kreditlar CRUD | ✅ | ✅ | 📖 |
| Hisobotlar | ✅ | ✅ | 📖 |
| Excel Import/Export | ✅ | ✅ | ❌ |
| Foydalanuvchilar boshqaruvi | ✅ | ❌ | ❌ |
| Sozlamalar | ✅ | ❌ | ❌ |

## 📊 Asosiy xususiyatlar

### Kirim/Chiqim
- Kirim va chiqim tranzaksiyalari
- Ichki o'tkazmalar (Double Entry Transfer)
- Immutable Ledger — tranzaksiyalar o'chirilmaydi, faqat bekor qilinadi
- Balans tranzaksiyalardan hisoblanadi

### Kreditlar
- Annuitet va Differensial kredit turlari
- Avtomatik jadval generatsiyasi
- Muddatidan oldin to'lov
- Qolgan qarzni hisoblash

### Hisobotlar
- Kunlik, haftalik, oylik, yillik
- Profit & Loss, Cash Flow, Balance
- KPI ko'rsatkichlari
- Top kategoriyalar va manbalar

### Excel
- Import: Preview, Validation, Duplicate Check, Mapping
- Export: Tranzaksiyalar, Kreditlar, Jadval
- Shablon generatsiyasi

### Audit Log
- Barcha operatsiyalar log qilinadi
- Foydalanuvchi, vaqt, o'zgarishlar

## 📡 REST API

### Endpoints

```
GET  /api/v1/health                    # Health check
GET  /api/v1/sources                   # Manbalar ro'yxati
POST /api/v1/sources                   # Manba yaratish
GET  /api/v1/sources/:id               # Manba ma'lumotlari
PUT  /api/v1/sources/:id               # Manba yangilash
DELETE /api/v1/sources/:id             # Manba arxivlash
GET  /api/v1/categories                # Kategoriyalar
POST /api/v1/categories                # Kategoriya yaratish
GET  /api/v1/transactions              # Tranzaksiyalar
POST /api/v1/transactions              # Tranzaksiya yaratish
POST /api/v1/transactions/transfer     # O'tkazma
POST /api/v1/transactions/:id/cancel   # Tranzaksiyani bekor qilish
GET  /api/v1/credits                   # Kreditlar
POST /api/v1/credits                   # Kredit yaratish
GET  /api/v1/reports/dashboard         # Dashboard
GET  /api/v1/reports/report            # Hisobot
GET  /api/v1/reports/kpi               # KPI
GET  /api/v1/excel/export/transactions # Excel export
GET  /api/v1/excel/export/credits      # Kreditlar export
GET  /api/v1/excel/template            # Import shablon
GET  /api/v1/users                     # Foydalanuvchilar
GET  /api/v1/audit                     # Audit log
```

## 🧪 Test

```bash
npm test
```

## 📝 Lint

```bash
npm run lint
npm run format
```

## 📄 Litsenziya

MIT
