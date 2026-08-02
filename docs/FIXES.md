# Tuzatilgan xato va kamchiliklar

Ushbu hujjat `arena/019fbe22-finance-manager` branchida bajarilgan audit natijalarini
va kiritilgan tuzatishlarni jamlaydi.

---

## 🔴 Xavfsizlik (kritik)

### 1. API'da autentifikatsiya umuman yo'q edi
**Muammo.** Barcha `/api/v1/*` route'lar mijoz yuborgan `x-user-id` va `x-user-role`
header'lariga so'zsiz ishonardi. Ya'ni istalgan odam:

```bash
curl -H "x-user-id: <birovning-id>" -H "x-user-role: ADMIN" .../api/v1/users
```

deb yozib, boshqa foydalanuvchi ma'lumotlarini o'qishi, admin API'lariga
(backup, audit log, rol o'zgartirish) kirishi mumkin edi.

**Yechim.** `src/api/api-auth.middleware.ts` qo'shildi:
- Telegram Mini App `initData` HMAC-SHA256 imzosi tekshiriladi
  (`WebAppData` secret key, `timingSafeEqual` bilan taqqoslash);
- `auth_date` eskirgani tekshiriladi (24 soat);
- foydalanuvchi va roli **serverda** aniqlanadi, mijozdan olinmaydi;
- header fallback faqat `NODE_ENV=development` da ishlaydi va ogohlantirish yozadi.

### 2. Admin route'lar himoyasiz edi
`/users`, `/audit`, `/backup`, `/queue` uchun `requireAdmin()` middleware qo'shildi.
`/audit` ilgari **umuman** rol tekshirmasdi — istalgan foydalanuvchi butun tizim
audit logini o'qiy olardi.

### 3. CORS hamma domenga ochiq edi
`cors()` → `MINI_APP_URL` va `APP_URL` whitelist'i bilan almashtirildi.

### 4. Webhook secret token tekshirilmasdi
Endi `x-telegram-bot-api-secret-token` header'i solishtiriladi; mos kelmasa 401.

---

## 🐛 Funksional xatolar

### 5. Kategoriyalar bo'sh turardi
- `prisma/seed.ts` kategoriyalar massivini e'lon qilardi, lekin **hech qachon
  bazaga yozmasdi** (`console.log("Seed completed!")` bilan tugardi);
- botdagi "Kirim/Chiqim" tanlash tugmalari (`category:create:income/expense`)
  ro'yxatdan o'tkazilmagan edi — bosilganda hech narsa bo'lmasdi;
- kategoriya nomini qabul qiladigan matn handleri yo'q edi.

**Yechim:** `default-categories.ts` (17 ta standart kategoriya),
`CategoriesService.ensureDefaults()` (ro'yxat ochilganda avtomatik yaratadi),
to'liq bot oqimi va `POST /categories/defaults` endpoint.

### 6. Tranzaksiya yaratib bo'lmasdi
"Kirim qo'shish" bosilganda bot miqdor so'rardi, lekin javobni **hech kim
qabul qilmasdi** — oqim shu yerda o'lardi.

**Yechim:** to'liq oqim — miqdor → kategoriya → manba (→ o'tkazma uchun qabul
qiluvchi) → saqlash. Qo'shimcha: `250k`, `1.5mln`, `1 500 000` kabi kiritishlar
`parseAmountInput()` bilan tushuniladi.

### 7. O'tkazmalar (TRANSFER) balansga ta'sir qilmasdi
`calculateSourceBalance` faqat `INCOME`/`EXPENSE` ni hisoblardi. O'tkazma
qilingandan keyin ikkala manba balansi ham o'zgarmay qolardi.

**Yechim:** `transferSourceId` (chiqim) va `transferTargetId` (kirim) ham
hisobga olinadi.

### 8. `bot.on("message")` boshqa handlerlarni bloklardi
`sources.handler.ts` dagi handler `next()` chaqirmasdi va **barcha** matnli
xabarlarni yutib yuborardi.

**Yechim:** `next()` qo'shildi; matn oqimli handlerlar `index.ts` da
eng oxirida ro'yxatdan o'tkaziladi.

### 9. Webhook har so'rovda `setWebhook` chaqirardi
Har bir kelgan update'da Telegram API'ga `setWebhook` yuborilardi — bu tez
orada rate limitga urardi. Endi bir marta startda o'rnatiladi.

### 10. `GET /transactions/balance/summary` ishlamasdi
`/:id` route'i undan oldin e'lon qilinganligi uchun `"balance"` id sifatida
talqin qilinardi. Tartib to'g'rilandi.

### 11. Kredit eslatmalari noto'g'ri maydondan o'qirdi
`payment.credit.userId` — Prisma sxemasida bunday maydon yo'q (`createdBy`).
Bundan tashqari bekor qilingan kreditlar va bloklangan foydalanuvchilar ham
eslatma olardi.

---

## ⚡ Optimallashtirish

### 12. N+1 so'rovlar
| Joy | Ilgari | Endi |
|---|---|---|
| Kategoriyalar ro'yxati | har kategoriya uchun 1 aggregate (20 ta = 20 so'rov) | 1 ta `groupBy` |
| Manbalar ro'yxati | har manba uchun 2 aggregate | 3 ta `groupBy` (transfer bilan) |
| `calculateBalanceByCurrency` | 6 valyuta × 2 = **12 ketma-ket** so'rov | 1 ta `groupBy` |
| `calculateBalance` | 2 aggregate | 1 ta `groupBy` |

### 13. Hisobotlar butun jadvalni xotiraga yuklardi
`sumByCategory` / `sumBySource` **barcha** tranzaksiyalarni `findMany` bilan
o'qib, JS'da yig'ardi. Yillik hisobotda bu o'n minglab qator degani.
Endi bazada `groupBy` qilinadi.

### 14. Kunlik eslatmalar ketma-ket yuborilardi
`for` ichida `await` — 1000 foydalanuvchi = 1000 ta ketma-ket navbat qo'shish.
Endi 50 talik bo'laklarda `Promise.allSettled`.

### 15. Sessiyalarda memory leak
Handler'lardagi `Map` hech qachon tozalanmasdi: oqim yarmida tashlab
ketilgan sessiya abadiy xotirada qolardi. `SessionStore` (TTL 15 daqiqa,
max 10 000 yozuv, avtomatik eviction) qo'shildi.

---

## 🛡 Barqarorlik

- **`bot.catch()`** — ilgari handler ichidagi istalgan istisno polling'ni
  to'xtatib qo'yishi mumkin edi;
- **Graceful shutdown** — 7 bosqich `try/catch` bilan, 15 soniyalik force-exit
  taymeri; ilgari `server.close()` kutilmasdi va `scheduler` umuman
  to'xtatilmasdi (`stop()` metodi yo'q edi);
- **`unhandledRejection` / `uncaughtException`** ishlovchilari;
- **Cron timezone** — endi `Asia/Tashkent` (ilgari server UTC'da bo'lsa,
  "09:00 eslatma" 14:00 da kelardi);
- **404 handler** — noma'lum API yo'llari HTML emas, JSON qaytaradi;
- **Zod / buzuq JSON** xatolari 500 emas, 400 bo'lib o'qiladigan ko'rinishda
  qaytadi;
- **`res.headersSent`** tekshiruvi (stream yuborilgandan keyingi xatolar).

---

## 🎯 Kiritish validatsiyasi

Ilgari query parametrlar shunchaki `as string` bilan cast qilinardi:
`?page=abc&limit=99999` → `NaN` yoki bazadan 99 999 qator. Endi barcha
ro'yxat/hisobot endpoint'lari zod sxemasi bilan tekshiriladi (`limit` max 100,
sanalar ISO formatda, enumlar qat'iy).

Takrorlanuvchi `try/catch + next(error)` bloklari `asyncHandler()` bilan
almashtirildi — bittasi unutilsa so'rov osilib qolardi.

---

## 📱 Mini App

- Mini App'ni ochish uchun **hech qanday tugma yo'q edi** — bosh menyuga
  `web_app` tugmasi qo'shildi (faqat HTTPS URL bo'lganda ko'rinadi);
- `fetch` uchun 20 soniyalik timeout (osilib qolgan so'rovlar);
- 401/403 va tarmoq xatolari uchun o'zbekcha, tushunarli xabarlar;
- bo'sh kategoriyalar sahifasida "Standart kategoriyalarni qo'shish" tugmasi.

---

## ✅ Sifat

- **Testlar:** 56 → **77** (yangi: `SessionStore`, Telegram initData imzosi,
  miqdor parseri);
- **Lint:** `npm run lint` avvaldan buzuq edi (`--max-warnings 0` bo'lsa-da
  16 ta warning + 3 ta error bor edi) — endi toza;
- **Typecheck & build:** backend va Mini App — ikkalasi ham toza.

---

## Ishga tushirish

```bash
npm install
npx prisma generate
npx prisma migrate deploy   # yoki: npm run db:push
npm run db:seed             # mavjud foydalanuvchilarga standart kategoriyalar
npm run dev
```

Mini App uchun `MINI_APP_URL` ni HTTPS manzil qilib qo'ying, aks holda
Telegram tugmani ko'rsatmaydi (log'da ogohlantirish chiqadi).
