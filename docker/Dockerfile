# ============================================
# 1-bosqich: backend build
# ============================================
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npx prisma generate
RUN npm run build

# ============================================
# 2-bosqich: Mini App build
# ============================================
FROM node:22-alpine AS miniapp-builder

WORKDIR /app/mini-app

COPY mini-app/package*.json ./
RUN npm ci

COPY mini-app/ ./
RUN npm run build

# ============================================
# 3-bosqich: runtime
# ============================================
FROM node:22-alpine AS runner

WORKDIR /app

# pg_dump / psql — backup va restore uchun majburiy.
# Ilgari o'rnatilmagan edi va har bir backup "pg_dump: not found"
# bilan yiqilardi. `tini` — PID 1 sifatida signallarni to'g'ri uzatadi.
RUN apk add --no-cache postgresql16-client tini \
    && addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs appuser

ENV NODE_ENV=production

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev \
    && npx prisma generate \
    && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
# Mini App statikasi: `express.static("mini-app/dist")` shu yerdan o'qiydi.
# Ilgari nusxalanmasdi va /mini-app doim 404 qaytarardi.
COPY --from=miniapp-builder /app/mini-app/dist ./mini-app/dist

# Backup katalogi (volume sifatida ulanadi)
RUN mkdir -p /app/backups && chown -R appuser:nodejs /app/backups

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.APP_PORT||3000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/index.js"]
