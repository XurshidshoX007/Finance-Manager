/**
 * Vitest uchun umumiy sozlash.
 *
 * Ba'zi modullar (logger, config) import paytidayoq muhit
 * o'zgaruvchilarini talab qiladi. Testlarda haqiqiy `.env` bo'lmagani
 * uchun bu yerda minimal, xavfsiz qiymatlar beriladi.
 */
process.env["NODE_ENV"] ??= "test";
process.env["BOT_TOKEN"] ??= "123456:TEST-TOKEN";
process.env["DATABASE_URL"] ??= "postgresql://test:test@127.0.0.1:5432/test?schema=public";
process.env["JWT_SECRET"] ??= "test-jwt-secret";
process.env["LOG_LEVEL"] ??= "silent";
