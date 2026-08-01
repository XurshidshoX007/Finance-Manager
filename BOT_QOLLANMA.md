# 📱 Finance Manager — Foydalanuvchi qo'llanmasi

## 🚀 Boshlash

Botga `/start` yuboring — avtomatik ro'yxatdan o'tasiz.
Suhbatda **pastda doimiy tugmalar** paydo bo'ladi — yozish shart emas, tugma bosing:

```
┌──────────────┬──────────────┐
│ 💵 Kirim     │ 🔴 Chiqim    │
│ 🔄 O'tkazma  │ 📊 Balans    │
│ 💼 Kreditlar │ 📈 Hisobotlar│
│ 💰 Manbalar  │ 📂 Kategoriya│
│ 📋 Bosh menyu│ ❓ Yordam    │
└──────────────┴──────────────┘
```

> Admin'larga qo'shimcha: `👥 Foydalanuvchilar` va `⚙️ Sozlamalar`

---

## 💵 Kirim / Chiqim qo'shish (pastki tugma bilan)

1. **💵 Kirim** yoki **🔴 Chiqim** tugmasini bosing
2. **Miqdorni** yozing (masalan: `500000`) → Enter
3. **Kategoriyani** tugmalardan tanlang
4. **Manbani** tanlang
5. Izoh yozing yoki **➡️ O'tkazib yuborish**
6. Tayyor! ✅

Jarayonni to'xtatish: **`/cancel`**

---

## 🔄 O'tkazma (manbadan manbaga)

1. **🔄 O'tkazma** tugmasi
2. Miqdorni yozing
3. **📤 Qaysi manbadan?** → tanlang
4. **📥 Qaysi manbaga?** → tanlang
5. Izoh yoki o'tkazib yuborish

---

## 📊 Balans

**📊 Balans** tugmasi bir bosishda:

- 🟢 Kirim (jami)
- 🔴 Chiqim (jami)
- 📊 Net (farqi)

---

## 📌 Qolgan bo'limlar

| Tugma | Nima qiladi |
|-------|-------------|
| 💼 Kreditlar | Kreditlar ro'yxati va holati |
| 📈 Hisobotlar | Dashboard, kunlik/oylilik hisobotlar, PDF |
| 💰 Manbalar | Mablag' manbalari |
| 📂 Kategoriyalar | Kirim/chiqim turlari |
| 📋 Bosh menyu | Umumiy menyu |
| ❓ Yordam | Ushbu qo'llanma |

Buyruqlar ham ishlayveradi: `/transactions`, `/credits`, `/reports`, `/sources`, `/categories`, `/profile`, `/role`, `/help`

---

## 🔐 Rollar qisqacha

| Imkoniyat | Admin | Manager | Employee |
|-----------|:-----:|:-------:|:--------:|
| Kirim/chiqim yozish | ✅ | ✅ | ✅ |
| Manba/kategoriya boshqarish | ✅ | ✅ | 📖 faqat ko'rish |
| Kreditlar boshqarish | ✅ | ✅ | 📖 faqat ko'rish |
| Hisobotlar | ✅ | ✅ | 📖 faqat ko'rish |
| Excel/PDF eksport | ✅ | ✅ | ❌ |
| Foydalanuvchilar, sozlamalar | ✅ | ❌ | ❌ |

---

## 💡 Eslatmalar

- Tranzaksiya **o'chirilmaydi**, faqat **bekor qilinadi** — bu xavfsizlik uchun.
- Xatolik bo'lsa, `/cancel` yuboring va qaytadan boshlang.
- Kredit eslatmalari va zaxira nusxalar **avtomatik** ishlaydi.
