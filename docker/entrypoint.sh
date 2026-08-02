#!/bin/sh
set -e

# ============================================
# Konteyner ishga tushishi
# ============================================
# Ilgari konteyner to'g'ridan-to'g'ri `node dist/index.js` ni ishga
# tushirardi: baza bo'sh bo'lsa jadvallar yaratilmagani uchun ilova
# birinchi so'rovdayoq yiqilardi. Endi migratsiyalar avtomatik
# qo'llaniladi.

echo "[entrypoint] Applying database migrations..."

if [ -d "prisma/migrations" ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  npx prisma migrate deploy
else
  # Migratsiya fayllari hali yaratilmagan loyihalar uchun zaxira yo'l
  echo "[entrypoint] No migrations found, syncing schema with db push..."
  npx prisma db push --skip-generate
fi

echo "[entrypoint] Database is ready."

exec "$@"
