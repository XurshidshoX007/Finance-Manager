# CI konfiguratsiyasi

`github-actions-ci.yml` — loyiha uchun tayyor GitHub Actions workflow'i.

## Nega bu yerda turibdi?

Ushbu fayl `.github/workflows/` katalogiga joylashtirilishi kerak, lekin
avtomatlashtirilgan agent GitHub App ruxsatlari `workflows` scope'ini
o'z ichiga olmagani uchun uni to'g'ridan-to'g'ri push qila olmaydi.

## Yoqish

Repozitoriyni lokal klon qilib, quyidagini bajaring:

```bash
mkdir -p .github/workflows
cp docs/ci/github-actions-ci.yml .github/workflows/ci.yml
git add .github/workflows/ci.yml
git commit -m "ci: enable GitHub Actions workflow"
git push
```

## Workflow nima tekshiradi?

| Job | Amallar |
|---|---|
| `backend` | `npm run lint`, `format:check`, `typecheck`, `test`, `build` |
| `mini-app` | `tsc -b --noEmit`, `npm run build` |
| `prisma` | `prisma validate` — sxema sintaksisi |
| `docker` | Docker образini to'liq build qiladi (backend + Mini App) |

## Eslatma

Ilgari CI fayli `docs/ci-cd.yml` sifatida saqlangan edi — ya'ni
GitHub uni hech qachon ishga tushirmagan. Bundan tashqari unda
`lint`, `format:check` va `test` bosqichlari umuman yo'q edi,
faqat `typecheck` va `build` bor edi.
