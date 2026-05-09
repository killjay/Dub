# DubKaroo — End-to-End Test Runbook

This guide walks you from zero to "uploaded a video, got dubbed videos out." Approximate time: **45–60 minutes**, mostly waiting on signups.

## What you'll have running

- **Postgres** (Docker, port 5432) — users, jobs, job_outputs, waitlist
- **Redis** (Docker, port 6379) — BullMQ queue
- **web** (Next.js, port 3000) — landing, dashboard, API routes
- **worker** (Node.js) — pulls jobs from Redis, runs the dub pipeline, writes outputs back to Postgres

---

## Phase 1 — Sign up for the four services (do these in parallel)

### 1.1 Cloudflare R2

1. Sign up at https://dash.cloudflare.com/sign-up
2. Cloudflare dashboard → **R2** → **Create bucket** → name it `dubkaroo`
3. R2 → **Manage R2 API Tokens** → **Create API Token**
   - Permissions: **Object Read & Write**
   - Specify bucket: `dubkaroo`
4. Copy: **Access Key ID**, **Secret Access Key**, and your **Account ID** (top-right of the dashboard, or in the bucket settings).

### 1.2 Clerk

1. Sign up at https://clerk.com
2. **Create application** → name it DubKaroo, enable **Email** + **Google** sign-in
3. Copy the **Publishable Key** (`pk_...`) and **Secret Key** (`sk_...`) from the API Keys page

### 1.3 Sarvam AI

1. Sign up at https://www.sarvam.ai/
2. Go to the dashboard → API keys → create one
3. Copy the API key (starts with something like `sk-...` or per their format)

> **Note:** Sarvam's pricing for the testing tier may require a paid plan or trial credit. If they require a sales call, fall back to **AI4Bharat IndicTrans2 + IndicTTS** (self-hosted, Apache 2.0). For first end-to-end test, $5–10 of Sarvam credit is more than enough.

### 1.4 Replicate

1. Sign up at https://replicate.com (Sign in with GitHub)
2. Account → API tokens → copy your token (starts with `r8_...`)
3. Add a payment method (Replicate has a free tier but Wav2Lip GPU calls are per-second billed). Budget ~$0.01–0.05 per dub for testing.

---

## Phase 2 — Local infrastructure

```bash
cd /Users/nandhakumarilangovan/dbkaroo
docker compose up -d
docker compose ps   # both services should be "healthy" within ~10 seconds
```

You should see `dubkaroo-postgres` and `dubkaroo-redis` running.

---

## Phase 3 — Configure web

```bash
cd web
cp .env.example .env.local
```

Edit `web/.env.local` — paste in the keys you collected:

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Postgres (local Docker)
DATABASE_URL=postgres://dubkaroo:dubkaroo@localhost:5432/dubkaroo

# Redis (local Docker)
REDIS_URL=redis://localhost:6379

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Cloudflare R2
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET=dubkaroo
```

(Sarvam, Replicate, and Razorpay keys go in `worker/.env`, not here — the web app doesn't need them.)

### 3.1 Push the schema to Postgres

```bash
npm run db:push
```

You should see Drizzle apply tables `waitlist`, `users`, `jobs`, `job_outputs`. If it asks "Are you sure?" answer yes (it's an empty DB).

### 3.2 Configure CORS on the R2 bucket

The browser uploads directly to R2 via a presigned PUT. R2 needs CORS allowed for your origin:

1. Cloudflare dashboard → R2 → `dubkaroo` bucket → **Settings** → **CORS Policy** → **Add CORS policy**
2. Paste:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

### 3.3 Start the web app

```bash
npm run dev   # http://localhost:3000
```

---

## Phase 4 — Configure worker

```bash
cd ../worker
cp .env.example .env
```

Edit `worker/.env`:

```bash
DATABASE_URL=postgres://dubkaroo:dubkaroo@localhost:5432/dubkaroo
REDIS_URL=redis://localhost:6379

# Sarvam
SARVAM_API_KEY=xxx
SARVAM_API_BASE=https://api.sarvam.ai

# Replicate (defaults to Wav2Lip; override REPLICATE_LIPSYNC_VERSION for MuseTalk)
REPLICATE_API_TOKEN=r8_xxx

# Same R2 creds as web
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET=dubkaroo

WORKER_CONCURRENCY=2
```

Start it:

```bash
npm run dev
```

You should see:
```
[worker] ready · queue=dub
```

---

## Phase 5 — Test it end-to-end

1. **Open http://localhost:3000** — landing page should render.
2. **Click "Sign in"** → Clerk modal → create an account with email or Google.
3. After sign-in you'll be redirected; click **Dashboard** in the nav. You should see "Free plan · 0 of 2 minutes used this month."
4. **New dub** → upload a short Hindi MP4 (≤30s for first test).
   - File picker → pick your video
   - Source language: **Hindi**
   - Targets: pick **Tamil** (just one for the first test)
   - Voice preset: **Warm female**
   - Click "Dub into 1 language"
5. The browser:
   - Hits `/api/jobs/presign` → gets a signed R2 PUT URL
   - PUTs the file directly to R2
   - Hits `/api/jobs` → enqueues to BullMQ → redirects to `/dashboard`
6. The worker terminal should print `[worker] active <job-id>`. The dashboard polls every 5s and shows the status flipping `queued → processing → succeeded`.
7. Click the job → wait for the green "succeeded" badge → an embedded video player appears with the dubbed Tamil version. Click "Download MP4 ↓".

### Test video

If you don't have one handy, here's a tiny one to use:

```bash
# A 10-second 720p test clip with synthetic speech (espeak-ng required, or just record yourself)
ffmpeg -f lavfi -i "color=c=black:s=720x1280:d=10" \
       -f lavfi -i "sine=frequency=440:duration=10" \
       -c:v libx264 -tune stillimage -c:a aac -b:a 128k \
       -shortest test-source.mp4
```

For a real lip-sync test, **record yourself** speaking Hindi for 15–30 seconds. Wav2Lip needs a visible face.

---

## Troubleshooting

### `/api/waitlist` returns 200 but landing form errors
The waitlist API still works without `DATABASE_URL` (falls back to `web/.waitlist.local.json`). Check the network tab.

### "Could not start the upload" on the upload page
R2 is misconfigured. Verify `R2_*` env vars in `web/.env.local` and that the bucket exists.

### Browser PUT to R2 returns CORS error
You forgot Phase 3.2. The CORS policy has to be set on the R2 bucket, not in code.

### Worker prints `[worker] failed`
- `replicate start 401`: bad `REPLICATE_API_TOKEN`
- `saarika 401`: bad `SARVAM_API_KEY`
- `r2 PUT … 403`: bad R2 creds, or bucket name mismatch
- `lipsync timed out after 25 min`: Wav2Lip queue on Replicate is busy; retry

### Job stuck in "queued"
Worker isn't running, or it's connected to the wrong Redis. Check `worker/.env` matches the Redis you started with `docker compose`.

### Dashboard shows `0 minutes used` even after a dub
The worker only increments quota on `succeeded` — failed jobs are free. Check `jobs.status` in the DB:

```bash
docker exec -it dubkaroo-postgres psql -U dubkaroo -c "SELECT id, status, duration_seconds, error_message FROM jobs ORDER BY created_at DESC LIMIT 5;"
```

### See what's in the DB live

```bash
cd web
npm run db:studio
# opens https://local.drizzle.studio in your browser
```

---

## What's NOT tested by this runbook

- **Razorpay billing** — not wired. `users.plan` defaults to `free` with a 2-minute quota. Override directly in DB to test Pro features:
  ```sql
  UPDATE users SET plan='pro', minutes_quota=240 WHERE clerk_user_id='user_xxx';
  ```
- **WhatsApp / email notifications** — not wired.
- **Watermark** — set `WATERMARK_PNG` to a transparent PNG path (will overlay during free-tier mux); otherwise free output is clean.
- **MuseTalk lip-sync** — defaults to Wav2Lip (no public Replicate version of MuseTalk exists). Deploy MuseTalk yourself and set `REPLICATE_LIPSYNC_VERSION` to swap.

---

## Sanity-check command set

```bash
# Both packages typecheck clean:
cd web && npm run build      # builds Next.js
cd ../worker && npx tsc --noEmit

# DB has rows:
docker exec dubkaroo-postgres psql -U dubkaroo -c "\dt"

# Queue has activity:
docker exec dubkaroo-redis redis-cli LLEN bull:dub:wait
```
