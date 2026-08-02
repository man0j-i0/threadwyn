# Deploying Threadwyn

Target: a live URL for the hackathon submission. Fastest reliable route is
**Neon (Postgres) + Vercel (app)**, both free tier. Budget 15 minutes.

---

## 1 · Database — Neon

1. Sign up at <https://neon.tech> and create a project (region: pick the one
   nearest your judges; `ap-southeast-1` for India).
2. From the dashboard, copy **two** connection strings:
   - the **pooled** one (host contains `-pooler`) → this becomes `DATABASE_URL`
   - the **direct** one (no `-pooler`) → you only need this locally, to run
     migrations

> Why two: serverless functions open a connection per invocation and would
> exhaust Postgres' connection limit in minutes. The pooler fixes that, but
> Prisma Migrate needs a direct session, so migrations run against the other.

---

## 2 · Schema and seed — run once, from your machine

```bash
# point at the DIRECT (non-pooler) Neon string just for this step
DATABASE_URL="postgresql://…neon.tech/neondb?sslmode=require" npx prisma migrate deploy
DATABASE_URL="postgresql://…neon.tech/neondb?sslmode=require" npx tsx prisma/seed.ts
```

You should see the seed summary: 12 categories, 8 suppliers, 60 products,
286 colourways, 14 orders.

> On Windows PowerShell, set it first instead:
> `$env:DATABASE_URL="…"; npx prisma migrate deploy`

---

## 3 · Push to GitHub

The repo is clean — local agent tooling (`.claude/`, `.mcp.json`,
`design-system/`) is gitignored, and `.env` was never committed.

```bash
gh repo create threadwyn --private --source=. --push
# or: git remote add origin git@github.com:<you>/threadwyn.git && git push -u origin main
```

---

## 4 · Vercel

1. <https://vercel.com/new> → import the repo. It will detect Next.js; leave
   the build settings alone (`npm run build` already runs `prisma generate`).
2. Add environment variables **before** the first deploy:

| Variable | Value |
|---|---|
| `DATABASE_URL` | the **pooled** Neon string |
| `AUTH_SECRET` | `openssl rand -base64 48` — or any 32+ random chars |
| `NEXT_PUBLIC_APP_URL` | `https://<your-project>.vercel.app` |
| `HF_TOKEN` | *optional* — a Hugging Face read token to enable hosted inference |

3. Deploy.

`NEXT_PUBLIC_APP_URL` is a chicken-and-egg: you don't know the URL until the
first deploy. Deploy once, copy the URL, set the variable, redeploy. It only
affects OG metadata and the sitemap, so the first deploy still works without it.

---

## 5 · Verify

```
/                        landing, hero cards, mill marquee
/marketplace             filters, 60 fabrics
/weavescope/<any-slug>   3D loom (check it loads — WebGL on the host's GPU)
/login                   buyer@threadwyn.dev / threadwyn
/dashboard               after login
/supplier                supplier1@threadwyn.dev / threadwyn
```

Then place one order end-to-end and move it along from the supplier side. If
that works, everything works.

---

## Things that will actually bite you

**Prisma engine mismatch.** `binaryTargets = ["native", "rhel-openssl-3.0.x"]`
is already set in `schema.prisma`. Without it, `prisma generate` produces an
engine for the build container only and the deployed function throws on its
first query. This is the single most common Prisma-on-Vercel failure.

**Connection exhaustion.** Use the pooled string for `DATABASE_URL`. If you see
`too many connections`, this is why.

**`AUTH_SECRET` shorter than 32 chars** throws at startup, by design — a weak
signing key is worse than a loud failure.

**Neon free tier suspends** after ~5 minutes idle. The first request after that
takes a few seconds while it wakes. Hit the site once before you start
recording your demo.

**No `HF_TOKEN` is fine.** Every AI surface falls back to the deterministic
engine — search, the assistant, product Q&A and onboarding all still work. Set
the token only if you want model-authored phrasing.

---

## Re-seeding a deployed database

```bash
DATABASE_URL="<direct neon string>" npx tsx prisma/seed.ts
```

The seed truncates first, so it is safe to re-run — useful right before
recording, to reset the demo order history to a clean state.
