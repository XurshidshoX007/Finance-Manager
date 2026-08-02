# Yakuniy audit hisoboti

`arena/019fbe22-finance-manager` branchida o'tkazilgan to'liq audit va
tuzatishlar. Jami **76 fayl**, **+4331 / −1206** qator.

| Ko'rsatkich | Boshida | Hozir |
|---|---|---|
| Testlar | 56 | **87** |
| `npm run lint` | ❌ 3 error + 16 warning | ✅ toza |
| `npm run format:check` | ❌ 44 faylda muammo | ✅ toza |
| `npm run typecheck` | ✅ | ✅ |
| Mini App build | ✅ | ✅ |
| Docker образ | ❌ ishlamasdi | ✅ |
| CI | ❌ noto'g'ri joyda, testsiz | ✅ 4 job |

---

## 🔴 Xavfsizlik (kritik)

### 1. API'da autentifikatsiya umuman yo'q edi
Barcha `/api/v1/*` route'lar mijoz yuborgan `x-user-id` va `x-user-role`
header'lariga so'zsiz ishonardi:

```bash
curl -H "x-user-id: <birovning-id>" -H "x-user-role: ADMIN" .../api/v1/users
```

Shu bir qator bilan istalgan odam boshqa foydalanuvchining moliyaviy
ma'lumotlarini o'qishi, backup olishi, rollarni o'zgartirishi mumkin edi.

**Yechim:** `src/api/api-auth.middleware.ts`
- Telegram Mini App `initData` HMAC-SHA256 imzosi tekshiriladi;
- `crypto.timingSafeEqual` (timing attack himoyasi);
- `auth_date` eskirgani tekshiriladi (24 soat);
- foydalanuvchi va roli **serverda** aniqlanadi;
- header fallback faqat `NODE_ENV=development` da.

### 2. Admin route'lar himoyasiz edi
`/audit` **umuman** rol tekshirmasdi — istalgan xodim butun tizim audit
logini o'qiy olardi. `/users`, `/backup`, `/queue` ham. Endi `requireAdmin()`.

### 3. Excel eksportida filtr injection
```js
const where = { createdBy: userId, isArchived: false, ...filters };
```
`filters` oxirida yoyilgani uchun `createdBy` ni almashtirib, birovning
tranzaksiyalarini eksport qilish mumkin edi. Tartib almashtirildi.

### 4. CORS hamma domenga ochiq edi
`cors()` → `MINI_APP_URL` / `APP_URL` whitelist'i.

### 5. Webhook secret token tekshirilmasdi
Endi `x-telegram-bot-api-secret-token` solishtiriladi; mos kelmasa 401.

### 6. docker-compose bazani tashqariga ochardi
`"5432:5432"` → `"127.0.0.1:5432:5432"`. Parollar endi majburiy
(`:?POSTGRES_PASSWORD is required`), hardcode qilingan `finance123` olib tashlandi.

---

## 🐛 Ishlamayotgan funksiyalar

### 7. Kategoriyalar bo'sh turardi *(dastlabki shikoyat)*
- `prisma/seed.ts` massivni e'lon qilardi, lekin **hech qachon bazaga yozmasdi**;
- `category:create:income/expense` callback'lari ro'yxatdan o'tkazilmagan —
  tugma bosilganda hech narsa bo'lmasdi;
- nomni qabul qiladigan matn handleri yo'q edi.

**Yechim:** 17 ta standart kategoriya, `ensureDefaults()` (ro'yxat ochilganda
avtomatik), to'liq bot oqimi, `POST /categories/defaults`.

### 8. Tranzaksiya yaratib bo'lmasdi
"Kirim qo'shish" miqdor so'rardi, lekin javobni **hech kim qabul qilmasdi** —
oqim shu yerda o'lardi. Endi: miqdor → kategoriya → manba → saqlash.
`250k`, `1.5mln`, `1 500 000` ko'rinishlari tushuniladi.

### 9. O'tkazmalar balansga ta'sir qilmasdi
`calculateSourceBalance` faqat INCOME/EXPENSE ni hisoblardi. O'tkazmadan keyin
ikkala manba balansi ham o'zgarmay qolardi.

### 10. Kredit erta to'lovi atomik emasdi
Qarzni yangilash, status, to'lov yozuvi — uchtasi alohida bajarilardi.
O'rtada xato chiqsa, qarz kamayib to'lov yozuvi yaratilmasdi. Endi
bitta `$transaction`. Qo'shimcha: to'liq yopilganda jadval qatorlari ham
yopiladi, 0/manfiy summa rad etiladi.

### 11. `bot.on("message")` boshqa handlerlarni bloklardi
`sources` handleri `next()` chaqirmay **barcha** matnli xabarlarni yutardi.

### 12. Webhook har so'rovda `setWebhook` chaqirardi
Har bir update'da Telegram API'ga so'rov — rate limitga urardi.

### 13. `GET /transactions/balance/summary` ishlamasdi
`/:id` route'i oldinda edi, `"balance"` id sifatida talqin qilinardi.

### 14. Kredit eslatmalari mavjud bo'lmagan maydondan o'qirdi
`payment.credit.userId` — sxemada bunday maydon yo'q (`createdBy`).
Bekor qilingan kreditlar va bloklangan foydalanuvchilar ham eslatma olardi.

### 15. Excel importda sana/valyuta tekshirilmasdi
`new Date("salom")` → `Invalid Date` bazaga yozilardi. Qator soni cheklanmagan.

### 16. Backup fayllari bir-birini o'chirardi
Nom faqat sanadan iborat edi: kunda ikkinchi backup birinchisining ustiga
yozilardi. Xato bo'lsa `.sql` fayl ham qolib ketardi.

### 17. Hisobot foizlari ma'nosiz edi
Kirim va chiqim qo'shilib bo'linardi. Endi har biri o'z bazasiga nisbatan.

### 18. Mini App yuklanish ekranida qotardi
SDK ulangan, lekin `ready()` hech qachon chaqirilmasdi. Mavzu ranglari
faqat Telegram o'rnatganda ishlardi — brauzerda oq-oq ko'rinardi.

---

## ⚡ Optimallashtirish

| Joy | Ilgari | Endi |
|---|---|---|
| Kategoriyalar ro'yxati | 20 ta aggregate | 1 ta `groupBy` |
| Manbalar ro'yxati | har manba uchun 2 ta | 3 ta `groupBy` |
| `calculateBalanceByCurrency` | **12 ketma-ket** so'rov | 1 ta `groupBy` |
| Dashboard | 9 ta (2 tasi takror) | 7 ta |
| Kredit statistikasi | 4 ketma-ket | `Promise.all` |
| Excel import | qator boshiga 1 `create` | 500 talik `createMany` |
| Kunlik eslatmalar | ketma-ket `await` | 50 talik `allSettled` |
| Auth (har tugma bosishda) | 2 ta UPDATE | 0 (5 daq. throttle) |

**Hisobotlar butun jadvalni xotiraga yuklardi:** `sumByCategory` /
`sumBySource` barcha tranzaksiyalarni `findMany` bilan o'qib JS'da yig'ardi.
Yillik hisobotda bu o'n minglab qator. Endi bazada `groupBy`.

**Sessiyalarda memory leak:** handler'lardagi `Map` hech qachon
tozalanmasdi. `SessionStore` (TTL 15 daq., max 10 000, avtomatik eviction).

---

## 🛡 Barqarorlik

- **`bot.catch()`** — handler ichidagi istisno polling'ni to'xtatib qo'yardi;
- **Graceful shutdown** — 7 bosqich, 15 s force-exit taymeri; ilgari
  `server.close()` kutilmasdi, `scheduler` umuman to'xtatilmasdi;
- **`unhandledRejection` / `uncaughtException`** ishlovchilari;
- **Cron timezone** — `Asia/Tashkent`; ilgari UTC serverida "09:00 eslatma"
  soat 14:00 da kelardi;
- **Telegram xatolari** — `editOrReply()` / `safeAnswerCallback()`:
  "message is not modified" va eskirgan callback'lar endi handler'ni yiqitmaydi;
- **appState tartibi** — auth middleware `prisma`/`redis` o'rniga
  `{} as PrismaClient` qo'yib ketardi; endi tartib to'g'ri;
- **404 / Zod / buzuq JSON** — HTML yoki 500 emas, tushunarli JSON;
- **`res.headersSent`** tekshiruvi (stream yuborilgandan keyin).

---

## 🎯 Validatsiya

Query parametrlar `as string` bilan cast qilinardi: `?limit=99999` →
bazadan 99 999 qator. Endi zod sxemasi (max 100, ISO sanalar, qat'iy enum).
Takrorlanuvchi `try/catch + next(error)` → `asyncHandler()`.

---

## 🐳 Infratuzilma

**Docker образи ishlamasdi:**
- `pg_dump` o'rnatilmagan — har bir backup "not found" bilan yiqilardi;
- Mini App build nusxalanmasdi — `/mini-app` doim 404;
- migratsiyalar qo'llanilmasdi — bo'sh bazada ilova birinchi so'rovda yiqilardi;
- PID 1 signal ishlovchisi yo'q edi (graceful shutdown ishlamasdi).

Qo'shildi: `postgresql16-client`, `tini`, `entrypoint.sh` (avtomatik
`migrate deploy`), Mini App build bosqichi, `HEALTHCHECK`, backup volume.

**CI `docs/ci-cd.yml` da yotardi** — GitHub uni hech qachon ishga
tushirmagan. Bundan tashqari `lint`, `format:check`, `test` yo'q edi.
Tayyor workflow `docs/ci/github-actions-ci.yml` da (yoqish yo'riqnomasi
`docs/ci/README.md` da — agent `.github/workflows/` ga push qila olmaydi).

---

## ✅ Testlar: 56 → 87

Yangi qamrov:
- `SessionStore` — TTL, eviction, max size (6);
- Telegram `initData` imzosi — soxta imzo, o'zgartirilgan user, eskirgan (7);
- Miqdor parseri — `250k`, `1.5mln`, manfiy, absurd (8);
- **API integratsiya testlari** — haqiqiy HTTP server ustida (10):
  spoofing rad etilishi, soxta imzo, admin himoyasi, query validatsiyasi.

---

## Ishga tushirish

```bash
npm install
npx prisma generate
npx prisma migrate deploy   # yoki: npm run db:push
npm run db:seed             # mavjud foydalanuvchilarga standart kategoriyalar
npm run dev
```

Docker orqali:

```bash
cp .env.example .env        # BOT_TOKEN, POSTGRES_PASSWORD, JWT_SECRET to'ldiring
docker compose up -d --build
```

**Eslatma:** Mini App tugmasi faqat `MINI_APP_URL` HTTPS bo'lganda
ko'rinadi (Telegram talabi) — aks holda log'da ogohlantirish chiqadi.
