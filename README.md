# DubKaroo

Vernacular dub + lip-sync platform for Indian YouTube/Instagram creators. See [dubkaroo_build_spec.md](./dubkaroo_build_spec.md) for the full product spec, weekly plan, GTM, and risk register.

## Layout

```
dbkaroo/
├── dubkaroo_build_spec.md   # the spec — single source of truth
├── web/                     # Next.js 15 app: landing, dashboard, billing, API routes
│   ├── src/app/             # routes (App Router)
│   ├── src/components/site/ # landing sections (Hero, LanguageDemo, Pricing, FAQ, Waitlist)
│   ├── src/components/dashboard/UploadForm.tsx
│   ├── src/components/ui/   # button, input, card, badge
│   ├── src/db/              # Drizzle schema + client (waitlist, users, jobs, jobOutputs)
│   ├── src/lib/r2.ts        # presigned PUT for direct browser → R2 uploads
│   └── src/app/api/         # /waitlist, /jobs, /jobs/presign
└── worker/                  # Node.js BullMQ consumer for the dub pipeline
    └── src/
        ├── index.ts         # BullMQ Worker entry point
        ├── pipeline/        # run.ts, ffmpeg.ts, time-align.ts, types.ts
        └── clients/         # sarvam.ts, replicate.ts, r2.ts
```

## What's already built (v1 scaffolding)

- **Landing page** — Hero, side-by-side language demo (7 languages), how-it-works, pricing (Free / Starter / Creator / Pro), FAQ, waitlist form, footer.
- **Waitlist API** — `POST /api/waitlist`, with Drizzle/Postgres backend and a local-JSON fallback so the form works without a DB. `GET /api/waitlist` returns the count.
- **Upload flow** — drag-drop UI → `/api/jobs/presign` (R2 presigned PUT) → direct browser upload → `/api/jobs` enqueue.
- **Dashboard** skeleton — usage card, jobs list, "new dub" CTA.
- **Auth pages** — `/sign-in`, `/sign-up` Clerk-ready stubs (replace internals with `<SignIn />` / `<SignUp />` once keys exist).
- **Legal** — `/legal/privacy`, `/legal/terms` placeholders pre-DPDP-template generation.
- **Worker** — BullMQ consumer with the full pipeline shape (download → ffprobe → audio extract → Sarvam Saarika ASR → for each language [Mayura translate → Bulbul TTS → atempo time-align → MuseTalk lip-sync → mux] → optional watermark → R2 upload).
- **Drizzle schema** — `waitlist`, `users`, `jobs`, `job_outputs`.

## What's stubbed and needs you

| Area | What's missing | File |
|---|---|---|
| Auth | Replace stub forms with Clerk's `<SignIn>` / `<SignUp>`, wrap layout in `<ClerkProvider>` | `web/src/app/sign-in/[[...sign-in]]/page.tsx`, `web/src/app/layout.tsx` |
| Plan enforcement | `/api/jobs` accepts any payload — check Clerk session + minute quota before enqueue | `web/src/app/api/jobs/route.ts` |
| Razorpay | UPI Subscription create/cancel/upgrade + webhook handler | not yet scaffolded |
| Watermark asset | Provide PNG with logo for free-tier overlay | set `WATERMARK_PNG` env, `worker/src/pipeline/ffmpeg.ts:addWatermark` |
| Sarvam endpoints | Verify exact response shapes against current docs (Saarika returns `transcript`/`timestamps`; Mayura returns `translated_text`; Bulbul returns base64 in `audios[0]`) | `worker/src/clients/sarvam.ts` |
| Replicate version | Set `REPLICATE_MUSETALK_VERSION` to the deployed version SHA | `worker/.env` |
| Dashboard live status | `/api/jobs/[id]/status` + WebSocket or polling | not yet scaffolded |
| WhatsApp/email | Gupshup + Resend on job-done | not yet scaffolded |

## Local dev

### web

```bash
cd web
cp .env.example .env.local   # leave keys blank to start; waitlist falls back to local JSON
npm install
npm run dev                  # http://localhost:3000
```

The waitlist form works with **no env vars set** — submissions are written to `web/.waitlist.local.json` (gitignored). Hit `GET /api/waitlist` to see the count.

The upload flow needs `R2_*` env vars; otherwise `/api/jobs/presign` returns 503 and the UI shows a friendly error.

### worker

```bash
cd worker
cp .env.example .env
npm install
npm run dev                  # tsx watch on src/index.ts
```

Worker requires `REDIS_URL`. For local dev, run Redis with:

```bash
docker run --rm -p 6379:6379 redis:7-alpine
# then: REDIS_URL=redis://localhost:6379
```

To trigger end-to-end you'll also need: `SARVAM_API_KEY`, `REPLICATE_API_TOKEN` + `REPLICATE_MUSETALK_VERSION`, and the four `R2_*` vars.

### Database (Postgres)

When you're ready to swap the JSON fallback for Postgres:

```bash
cd web
# 1. set DATABASE_URL in .env.local (Neon: https://neon.tech)
npx drizzle-kit push    # or `generate` + `migrate` for proper migrations
```

## Deployment recipe (per spec §6.1)

| Layer | Where | Notes |
|---|---|---|
| `web/` | Vercel | Set all `web/.env.example` vars in Vercel project settings. |
| `worker/` | Railway | Long-running Node service. Needs FFmpeg from `ffmpeg-static`; no extra system deps. Set `WORKER_CONCURRENCY=2–4` to start. |
| Postgres | Neon | Use the pooled connection string. Drizzle reads `DATABASE_URL`. |
| Redis | Upstash | Free tier is fine until ~10K jobs/month. |
| R2 | Cloudflare | Public base URL (e.g. `media.dubkaroo.com`) for served outputs; private bucket for uploads. |
| Lip-sync | Replicate (start) → RunPod (scale) | Per spec §6.4: switch when MRR > $5K. |

## Build verification

Both packages typecheck clean, and `web/` builds with `next build` (12 routes generated).

```bash
cd web && npm run build
cd worker && npx tsc --noEmit
```

## Most important thing (per spec §16)

**Don't build for 6 weeks then start selling.** Use the landing page as-is, manually dub 5 sample videos with Sarvam Studio + a free MuseTalk Colab, and DM 10 creators per day. By the time the worker is wired end-to-end, you should already have 30+ creators who've seen your dubs.

If after 50 manual dubs no creator shows enthusiasm, kill it.
