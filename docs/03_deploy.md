# Deploying Threadwyn

Goal: one public URL that stays up, for the hackathon submission.

**Recommended: Neon (Postgres) + Vercel (app).** Both free. About 20 minutes.

---

## Why this pairing

Threadwyn is a Next.js app with a Postgres database and no background workers.
That is exactly the shape Vercel and Neon are built for, and the whole thing
fits inside two free tiers.

| Option | Verdict |
|---|---|
| **Vercel + Neon** | **Chosen.** Zero-config for Next.js, git-push deploys, free TLS, one URL. |
| Render | Free web service **sleeps after 15 min and takes ~50s to wake**. Fatal for a judge clicking a link. |
| Railway | No free tier any more — trial credit only, then it stops. |
| Fly.io | Good, but you hand-write a Dockerfile and manage a Postgres volume. More moving parts for no gain here. |
| Supabase + Vercel | Fine alternative. Supabase gives 500 MB and does not suspend, but bundles auth/storage we do not use. |
| Netlify | Next.js support lags Vercel's. Not worth the risk on Next 16. |

---

## 1 · Database — Neon

1. <https://neon.tech> → sign up with GitHub → **Create project**.
2. Region: pick the one nearest your judges (`ap-southeast-1` Singapore is the
   closest to India).
3. From **Connection Details**, copy **two** strings:
   - **Pooled** — host contains `-pooler`. This is your `DATABASE_URL`.
   - **Direct** — no `-pooler`. Used once, from your machine, for migrations.

> **Why two.** Every serverless invocation opens its own connection, and
> Postgres' connection limit would be gone in minutes. The pooler solves that.
> But Prisma Migrate needs a real session, which the pooler cannot give it — so
> migrations run against the direct string.

**Free tier:** 0.5 GB storage · 100 CU-hours compute/month · 5 GB transfer.
([plan details](https://neon.com/docs/introduction/plans))

---

## 2 · Schema and seed — once, from your machine

PowerShell:

```powershell
$env:DATABASE_URL="<DIRECT neon string>"
npx prisma migrate deploy
npx tsx prisma/seed.ts
```

bash:

```bash
DATABASE_URL="<DIRECT neon string>" npx prisma migrate deploy
DATABASE_URL="<DIRECT neon string>" npx tsx prisma/seed.ts
```

Expect: 12 categories, 8 suppliers, 60 products, 286 colourways, 14 orders.

---

## 3 · GitHub

The repo is already clean — `.claude/`, `.mcp.json` and `design-system/` are
gitignored, and `.env` was never committed.

```bash
gh repo create threadwyn --private --source=. --push
# or
git remote add origin git@github.com:<you>/threadwyn.git
git push -u origin main
```

---

## 4 · Vercel

1. <https://vercel.com/new> → **Import** the repo. It detects Next.js; change
   nothing (`npm run build` already runs `prisma generate`).
2. Add environment variables **before** the first deploy:

| Variable | Value | Required |
|---|---|---|
| `DATABASE_URL` | the **pooled** Neon string | yes |
| `AUTH_SECRET` | `openssl rand -base64 48` (32+ chars) | yes |
| `NEXT_PUBLIC_APP_URL` | `https://<project>.vercel.app` | after first deploy |
| `HF_TOKEN` | Hugging Face read token | no |
| `HF_CHAT_MODEL` | `Qwen/Qwen2.5-7B-Instruct` | no |
| `AI_TIMEOUT_MS` | `8000` if AI replies fail rather than fall back | no |

3. **Deploy.**
4. Copy the URL, set `NEXT_PUBLIC_APP_URL` to it, redeploy. It only affects OG
   tags and the sitemap, so the first deploy works fine without it.

**Free tier:** 100 GB bandwidth · 1M edge requests · 6,000 build minutes ·
functions default to 10s, ceiling 60s.
([limits](https://deploywise.dev/blog/vercel-free-tier-limits-2026))

---

## 5 · Verify

Visit in this order:

```
/                          landing, hero cards, mill marquee
/marketplace               filters, 60 fabrics
/weavescope/<any-slug>     3D loom — confirm WebGL runs on the judge's machine
/login                     buyer@threadwyn.dev / threadwyn
/dashboard
/supplier                  supplier1@threadwyn.dev / threadwyn
```

Then place one order end to end and advance it from the supplier side. If that
works, everything works.

---

## What will actually bite you

**Prisma engine mismatch.** Already handled — `binaryTargets` includes
`rhel-openssl-3.0.x`. Without it the deployed function throws on its first
query. The most common Prisma-on-Vercel failure.

**Connection exhaustion.** Use the *pooled* string. `too many connections`
means you used the direct one.

**Function timeout on AI.** Vercel Hobby defaults to a 10s function. A slow
model reply would be killed by the platform *before* our own fallback fires,
so the request fails instead of degrading to the rule engine. If you see AI
replies erroring rather than answering, set `AI_TIMEOUT_MS=8000`.

**Neon storage and uploaded photos.** Supplier photo uploads are stored as
bytes in Postgres, against 0.5 GB. The seed uses none (swatches are rendered),
so you start near zero — but don't upload fifty photos while demoing.

**Vercel Hobby forbids commercial use.** A hackathon submission is not
commercial, so you are fine. Know it before you point a client at it.

**`AUTH_SECRET` under 32 chars throws at boot.** Deliberate — a weak signing
key should fail loudly.

---

## Is it up all the time?

**The app: yes.** Vercel does not sleep. The URL answers 24/7.

**The database: it suspends, and wakes itself.** Neon's free tier scales to
zero after 5 minutes idle. The next query wakes it in roughly
**0.5–2 seconds**, automatically. Nothing errors; one request is slow, then it
is fast again.

Practically:

- A judge opening the link cold waits about a second longer on the first page.
- Everything after that is normal speed.
- **Hit the site yourself right before demoing or recording** so the database
  is already warm.

If you want zero cold starts, Neon's paid tier disables scale-to-zero. Not
worth it for a hackathon.

---

## Re-seeding before a recording

```bash
DATABASE_URL="<direct neon string>" npx tsx prisma/seed.ts
```

The seed truncates first, so it is safe to re-run and resets order history to a
clean demo state.
