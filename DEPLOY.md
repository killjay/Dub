# DubKaroo — Production Deploy

Spec recipe: **Vercel + Railway + Neon + Upstash + Cloudflare R2 + Modal**.

Cost trajectory: ~$0/mo at zero, ~$5–15/mo at first 10 paying customers, ~$50–100/mo at 250 customers.

---

## Prerequisites

- This repo pushed to a GitHub account (any account works; private repo is fine).
- Cloudflare R2 already set up (you have this).
- Modal endpoints already deployed (you have this — MuseTalk + LatentSync).

---

## Step 1 — Push code to GitHub (5 min)

```bash
cd /Users/nandhakumarilangovan/dbkaroo
git add .
git commit -m "Initial DubKaroo build"
```

Then create a private GitHub repo at https://github.com/new (name: `dubkaroo`), and push:

```bash
git remote add origin https://github.com/<your-username>/dubkaroo.git
git push -u origin main
```

---

## Step 2 — Postgres on Neon (5 min)

1. Sign up at https://neon.tech (Google sign-in fine)
2. **Create project** → name `dubkaroo`, region **AWS Mumbai (ap-south-1)**, Postgres 16
3. Copy the **pooled connection string** from the dashboard. Looks like:
   ```
   postgres://user:pass@ep-xxx-pooler.ap-south-1.aws.neon.tech/dubkaroo
   ```
4. Apply the schema:
   ```bash
   cd web
   DATABASE_URL='<pooled-url>' npx drizzle-kit generate
   cat drizzle/0000_*.sql | psql '<direct-non-pooled-url>'
   ```
   Or use Neon's SQL editor in the dashboard — paste the contents of `web/drizzle/0000_thankful_junta.sql` (and any newer migrations) and run.

You'll need TWO connection strings from Neon: a **pooled** one (for runtime queries) and a **direct** one (for migrations). The dashboard shows both.

---

## Step 3 — Redis on Upstash (3 min)

1. Sign up at https://upstash.com
2. **Create database** → Redis → name `dubkaroo`, region **AP-South-1 (Mumbai)**, type **Regional**
3. Copy the **Redis URL with TLS**. Looks like:
   ```
   rediss://default:xxx@gusc1-xxx.upstash.io:6379
   ```
   (The `s` in `rediss://` matters — it enables TLS, which Upstash requires.)

---

## Step 4 — Web app on Vercel (5 min)

1. Sign up at https://vercel.com (use GitHub auth — you're going to need the integration anyway)
2. **Add New → Project** → import `<your-username>/dubkaroo`
3. **Root directory:** `web`
4. Vercel auto-detects Next.js. Don't change build/install commands.
5. Click **Environment Variables** and paste these (from your `web/.env.local`, with the new prod values):

   ```
   NEXT_PUBLIC_SITE_URL=https://<your-vercel-project>.vercel.app
   DATABASE_URL=<Neon pooled URL>
   REDIS_URL=<Upstash Redis URL with rediss://>
   SESSION_SECRET=<the long random string from your .env.local>
   GOOGLE_OAUTH_CLIENT_ID=<your value>
   GOOGLE_OAUTH_CLIENT_SECRET=<your value>
   GOOGLE_OAUTH_REDIRECT_URI=https://<your-vercel-project>.vercel.app/api/auth/google/callback
   R2_ACCOUNT_ID=<your value>
   R2_ACCESS_KEY_ID=<your value>
   R2_SECRET_ACCESS_KEY=<your value>
   R2_BUCKET=dubkaroo
   ```
6. Click **Deploy**. ~2 min.
7. Vercel gives you a URL like `dubkaroo-xxx.vercel.app`. Update `NEXT_PUBLIC_SITE_URL` and `GOOGLE_OAUTH_REDIRECT_URI` to match, then redeploy.

### After deploy

- Update **Google OAuth** authorized redirect URIs at https://console.cloud.google.com/apis/credentials → add `https://<your-vercel-url>/api/auth/google/callback`.
- Update **Cloudflare R2 CORS** to allow your Vercel URL — same JSON as for localhost but with the Vercel domain.

---

## Step 5 — Worker on Railway (5 min)

1. Sign up at https://railway.app (use GitHub auth)
2. **New Project → Deploy from GitHub repo** → select `dubkaroo`
3. **Root directory**: `worker` (in service settings)
4. Railway auto-detects Nixpacks. The repo's `worker/railway.json` configures the build/start commands.
5. **Variables** tab → paste from `worker/.env`, with the new prod values:

   ```
   DATABASE_URL=<Neon pooled URL>
   REDIS_URL=<Upstash Redis URL>
   SARVAM_API_KEY=<your value>
   SARVAM_API_BASE=https://api.sarvam.ai
   REPLICATE_API_TOKEN=<your value>
   REPLICATE_LIPSYNC_MODEL=modal-latentsync
   MUSETALK_MODAL_URL=<your existing Modal URL>
   MUSETALK_AUTH_KEY=<same WEB_AUTH_KEY>
   LATENTSYNC_MODAL_URL=<your existing Modal URL>
   LATENTSYNC_AUTH_KEY=<same WEB_AUTH_KEY>
   R2_ACCOUNT_ID=<your value>
   R2_ACCESS_KEY_ID=<your value>
   R2_SECRET_ACCESS_KEY=<your value>
   R2_BUCKET=dubkaroo
   WORKER_CONCURRENCY=4
   ```
6. **Deploy**. Railway logs should show `[worker] ready · queue=dub` within ~2 min.

---

## Step 6 — Custom domain (optional, 10 min)

1. Buy `dubkaroo.com` and `dubkaroo.in` at any registrar (Namecheap, Google Domains, GoDaddy). Cost ~₹2,000/yr both.
2. Point DNS to **Cloudflare** (free): add the domain at https://dash.cloudflare.com → change nameservers at registrar.
3. In Vercel project → **Settings → Domains** → add `dubkaroo.com` and `www.dubkaroo.com`. Vercel will tell Cloudflare what records to add. SSL auto-provisions.
4. Update `NEXT_PUBLIC_SITE_URL` and `GOOGLE_OAUTH_REDIRECT_URI` to use the new domain. Update Google OAuth + R2 CORS too.

---

## Step 7 — Smoke test prod

1. Open `https://dubkaroo.com/sign-up` → create an account
2. Upload a 15s test video → choose 1 language → submit
3. Watch Railway worker logs (in dashboard) — you should see:
   ```
   [worker] active <uuid>
   [worker] picked job <uuid> (1 languages)
   [lipsync] downloading inputs
   ```
4. ~3–8 min later: dashboard shows "succeeded", clicking the job plays the dubbed video.

---

## Recurring ops

- **Watch logs**: Vercel for web requests, Railway for worker logs, Modal dashboard for GPU runs.
- **Cost monitoring**: set spend alerts on Railway, Modal, Replicate.
- **Backups**: Neon does point-in-time recovery on the paid tier. Free tier doesn't — sign up for that before customer data lands.
- **Migrations**: when the schema changes, run `drizzle-kit generate` locally, paste the new SQL into Neon's SQL editor.
- **Scaling**: bump `WORKER_CONCURRENCY` on Railway as queue depth grows. Add Railway replicas (paid tier).

---

## Production env-var checklist

Web (Vercel):
- [x] `NEXT_PUBLIC_SITE_URL` (prod URL)
- [x] `DATABASE_URL` (Neon pooled)
- [x] `REDIS_URL` (Upstash, `rediss://`)
- [x] `SESSION_SECRET` (48-byte random; fresh for prod, do NOT reuse dev secret)
- [x] `GOOGLE_OAUTH_CLIENT_ID` / `_SECRET` / `_REDIRECT_URI`
- [x] `R2_*`

Worker (Railway):
- [x] `DATABASE_URL`, `REDIS_URL` (same as web)
- [x] `SARVAM_API_KEY`
- [x] `REPLICATE_API_TOKEN` (only if you fall back to Replicate models)
- [x] `REPLICATE_LIPSYNC_MODEL=modal-latentsync`
- [x] `MUSETALK_MODAL_URL`, `MUSETALK_AUTH_KEY`
- [x] `LATENTSYNC_MODAL_URL`, `LATENTSYNC_AUTH_KEY`
- [x] `R2_*`
- [x] `WORKER_CONCURRENCY=4` (or higher)

---

## What's NOT yet wired for prod (TODO before launch)

- **Razorpay UPI Subscription** — paid plans currently auto-grant unlimited; need real billing wiring
- **WhatsApp / email notifications** on job completion (Gupshup + Resend)
- **Sentry** error tracking
- **PostHog** product analytics
- **Watermark PNG** for free-tier outputs
