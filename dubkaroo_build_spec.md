# DubKaroo — Build Spec

*Vernacular dub + lip-sync platform for Indian YouTube/Instagram creators. Solo-founder build doc, May 2026.*

---

## 1. One-line pitch

Upload a Hindi (or English) reel; get Tamil, Telugu, Marathi, Bengali, Kannada, and Bhojpuri versions back in under 10 minutes — natural voices, lip-synced, ready to publish — for ₹1,499/month.

## 2. Why this exists

- 60%+ of YouTube India watch time is in regional languages, growing 18% CAGR vs ~3% for English.
- A creator with 200K Hindi subscribers cannot today get a good Tamil version of a video for under ₹3,000 per minute (manual dubbing studios). Submagic / ElevenLabs / HeyGen handle Spanish/French well but their Indic quality is weak and pricing is in USD.
- Sarvam AI's Bulbul + Saarika and AI4Bharat's IndicTrans2 + IndicConformer have collapsed the per-minute cost of high-quality Indic voice + translation by ~20× since 2024.
- Open-source lip-sync (MuseTalk, LatentSync) is now good enough on Indian faces, especially for short-form vertical video where the face occupies <40% of the frame.

The window is open: ~12 months before HeyGen / ElevenLabs ship a serious India SKU. Speed matters.

## 3. Target user (be specific)

**Primary persona — "Mid-tier Hindi YouTuber with regional ambition"**
- 50K–500K subscribers on YouTube
- 1–4 long-form videos/week + 5–15 Shorts/week
- Already monetized (AdSense + brand deals)
- Verticals where regional dubbing has the biggest watch-time lift: **finance/personal-money education, devotional/spiritual, food, motivational/self-help, news commentary, gaming, tech reviews, parenting**
- Pain quote (from interviews): "I know my Tamil viewers are there, my analytics show it. But hiring a dubbing studio for ₹3K/min × 12 mins × 4 languages = ₹1.4 lakh per video. No way."

**Secondary personas (post-MVP):**
- Indian D2C brand making product videos
- EdTech course creators (Unacademy/Physics Wallah-tier individual educators)
- Religious organizations (huge devotional vertical)

**Anti-personas (don't chase yet):**
- Bollywood / film studios — wrong scale, RFP-driven, not self-serve
- Global creators who want English↔Hindi — different distribution channel
- Hyper-low-budget hobbyists — won't pay subscriptions

## 4. MVP scope — what ships in v1

**In:**
- Upload a video (max 10 min, ≤500 MB) in Hindi or English source
- Choose 1+ target language from: Tamil, Telugu, Marathi, Bengali, Kannada, Bhojpuri (Hindi is also a target if source is English)
- Auto-generated dubbed audio with one of 4–6 stock Sarvam voices (m/f, bright/warm)
- Lip-sync via MuseTalk or LatentSync (whichever wins QA)
- Output: MP4 with new audio + lip-sync, plus separate dubbed-audio-only WAV for podcast use
- Free tier: 2 min/month, watermark "Made with DubKaroo" + 1 language only
- Paid tiers via Razorpay UPI AutoPay (see §8)
- WhatsApp + email notification when job is done

**Explicitly out of v1 (sequenced for v2/v3):**
- Voice cloning of the creator's own voice
- Subtitle / caption generation (creators already use Submagic for this)
- Title / description / thumbnail localization
- Bulk batch upload
- API access
- Multi-speaker dialogue handling (single-speaker assumption in v1)
- Music separation (assume creator uploads voice-dominant audio in v1; document in onboarding)
- Mobile app (responsive web is enough)

## 5. Validation criteria

Before scaling spend, you need to hit ALL of these in the first 60 days:

| Metric | Target | If you miss it |
|---|---|---|
| First paid subscription | Day 21 | Re-evaluate ICP — wrong vertical |
| 10 paid subs | Day 60 | Pricing or quality gap; A/B both |
| First creator who organically posts "I used DubKaroo" on X / IG | Day 45 | Quality is below bar; invest in lip-sync upgrade |
| Free → paid conversion | ≥6% | Free tier too generous, or quality not showing in 2 free min |
| D30 retention | ≥75% (creators rarely churn fast if quality holds) | Output is unusable; refunds + post-mortem |

## 6. Technical architecture

### 6.1 Stack (chosen for "build solo in 6 weeks")

| Layer | Choice | Why |
|---|---|---|
| Frontend | **Next.js 15 + Tailwind + shadcn** | Fast dev, easy deploy, server-side video preview |
| Auth | **Clerk** (free tier ≤10K MAU) | Don't write auth in 2026 |
| Backend | **Hono on Cloudflare Workers** for the API layer + **Node.js worker on Railway** for video processing | Workers for cheap edge API; Railway worker because Workers can't run FFmpeg |
| DB | **Postgres on Neon** (free tier → ~$20/mo at scale) | Branching makes preview envs cheap |
| Job queue | **BullMQ + Redis (Upstash)** | Standard, proven, $10/mo at start |
| Object storage | **Cloudflare R2** | Zero egress fees — critical when you're shipping back 100 MB MP4s |
| Payments | **Razorpay** — UPI AutoPay subscriptions + one-time | Zero MDR on UPI, native UPI Subscription |
| Email/WhatsApp | **Resend** for email + **Gupshup BSP** for WhatsApp delivery | Resend is cleanest in 2026; Gupshup is cheapest WABA in India |
| Observability | **Sentry** + **PostHog** | Free tiers cover early stage |
| Analytics | **PostHog** | Self-host later if cost scales |

### 6.2 The pipeline (single video → 4 dubs)

```
[Creator uploads MP4]
        ↓
[1. Pre-check]      — ffprobe: duration, audio track present, ≤10 min, ≤500MB
        ↓
[2. Audio extract]  — ffmpeg → 16kHz WAV
        ↓
[3. (optional) Voice isolation]  — Sarvam Mukta-Vaani or Spleeter to strip background music
        ↓
[4. ASR]            — Sarvam Saarika v2  →  word-timestamped Hindi text
        ↓
[5. For each target language, in parallel:]
        ├─ [5a. Translate]  Sarvam Mayura  OR  AI4Bharat IndicTrans2
        ├─ [5b. TTS]        Sarvam Bulbul v2 with selected voice
        ├─ [5c. Time-align] Stretch/compress per-segment to match original word timestamps (FFmpeg atempo + crossfade)
        └─ [5d. Lip-sync]   MuseTalk on RunPod or Replicate GPU → output MP4
        ↓
[6. Mux + watermark] — FFmpeg final compose; add intro tag for free tier
        ↓
[7. Upload outputs]  — Cloudflare R2 with signed URLs
        ↓
[8. Notify]          — WhatsApp + email; show in dashboard
```

**End-to-end target:** 1 minute of source video → 4 language outputs in <8 minutes wall-clock.

### 6.3 Critical model choices (and what they cost)

| Stage | Primary model | Fallback | Cost per 1 min source video |
|---|---|---|---|
| ASR | Sarvam Saarika v2 | AI4Bharat IndicConformer (self-hosted) | ~₹0.4 |
| Translation | Sarvam Mayura | IndicTrans2 (self-hosted on Modal) | ~₹0.3 per language |
| TTS | Sarvam Bulbul v2 (4–6 voice presets) | AI4Bharat IndicTTS | ~₹1.2 per language |
| Lip-sync | **MuseTalk** (better mouth shapes for Devanagari/Dravidian phonemes than Wav2Lip) | LatentSync, Wav2Lip as cheap fallback | ~₹2.5 per language (T4 GPU) |

**Total inference cost per 1-min source video, dubbed to 4 languages:** ~₹0.4 (ASR) + 4 × (₹0.3 + ₹1.2 + ₹2.5) = **~₹16.4 per minute**. Storage + egress add ~₹1. Round to **₹18/min total cost**.

### 6.4 Why MuseTalk (not Wav2Lip)

- Wav2Lip is the open-source default but has visible artefacts on Devanagari/Dravidian phonemes (especially retroflex consonants ट/ड/ण/ड़).
- MuseTalk operates in latent space on top of SD-VAE, with better blending and 30 fps real-time on a V100/T4. Apache 2.0 license — commercial use allowed.
- LatentSync (ByteDance, 2024) is the highest quality but slower and licensed less liberally; keep as a "premium quality" lever for the Pro tier.
- Run on **RunPod serverless GPU** (T4 ~$0.20/hr) or **Replicate** (easier, ~2× more expensive). Start on Replicate, migrate to RunPod when MRR > $5K.

## 7. Cost & unit economics

| Tier | Price/mo | Minutes | Languages | Cost/mo (inference) | Gross margin |
|---|---|---|---|---|---|
| Free | ₹0 | 2 | 1 | ₹6 | acquisition |
| Starter | ₹999 | 30 | 3 | ~₹300 | 70% |
| Creator | ₹2,499 | 90 | All 6 | ~₹980 | 61% |
| Pro | ₹4,999 | 240 | All 6 + LatentSync | ~₹2,800 | 44% |
| Pay-as-you-go add-on | ₹49/min | 1 | up to 4 | ~₹16 | 67% |

Blended gross margin target at 1,000 paying customers: **~60%**. UPI AutoPay charges zero MDR, so payment costs are negligible (Razorpay platform fee ~2% only on non-UPI).

**Breakeven math:** fixed costs (Sarvam minimum, Replicate minimum, Railway, Neon, Upstash, Resend, domain, Razorpay, Sentry, PostHog) ≈ ₹40K/month at start. ~30 Creator-tier subs × ₹2,499 × 60% margin = ₹45K gross profit → roughly breakeven at **30 paying customers**.

## 8. Pricing & billing

### 8.1 Plans

- **Free** — 2 min/mo, 1 language, watermark intro 3 sec, queue last priority. Watermark is "Made with DubKaroo · दुबकरूं.com" with logo bug for first 3 seconds — the viral hook.
- **Starter ₹999/mo** — 30 min, choose any 3 of 6 languages, no watermark, standard queue.
- **Creator ₹2,499/mo** — 90 min, all 6 languages, priority queue, WhatsApp notifications, voice preset library.
- **Pro ₹4,999/mo** — 240 min, all 6 languages, LatentSync (premium lip-sync), batch upload, 1 voice clone slot when v2 ships, API access (waitlist).
- **Annual** — 2 months free if billed annually (10× monthly rate).

Pay-as-you-go top-up at ₹49/minute per language for spillover above plan limit.

### 8.2 Billing rails

- **Razorpay UPI Subscription / e-Mandate** for monthly recurring. UPI AutoPay flow: user authorizes once, scoot ₹2,499 monthly with zero MDR.
- **One-time top-ups** also via Razorpay; UPI Intent or QR.
- **No GST registration in v1** — defer until annual revenue crosses ₹20L (registration threshold). Keep accounting clean for retroactive collection if needed.
- **Invoice numbering:** sequential, FY-prefixed, never gapped. Razorpay handles this if you use their invoice product.

## 9. Build plan — week by week

### Week 1 — Foundation + sales surface
- Domain (`dubkaroo.com`, `dubkaroo.in`) + email
- Next.js + shadcn skeleton
- Clerk auth + Postgres user table on Neon
- **Landing page with side-by-side dub demo** (use 5 sample dubs you make manually with Sarvam Studio + MuseTalk Colab) — **this is the most important deliverable of week 1**, not the app
- Razorpay sandbox account + first test UPI payment
- Cloudflare R2 bucket + signed URL pattern

**Goal of week 1:** start collecting waitlist emails. Should be at 100+ by Saturday.

### Week 2 — Pipeline v1 (single language, no lip-sync)
- Video upload UI (drag-drop, ffprobe pre-check)
- BullMQ + Upstash Redis worker on Railway
- FFmpeg audio extraction
- Sarvam Saarika ASR integration
- Sarvam Mayura translation (Hindi → Tamil only for v1)
- Sarvam Bulbul TTS
- Mux dubbed audio over original video (no lip-sync, just voice swap)
- Output preview in dashboard

**Goal of week 2:** end-to-end pipeline working for one language without lip-sync. Send 5 test outputs to friends for QA.

### Week 3 — Lip-sync + multi-language
- MuseTalk on Replicate (start there, optimize later)
- A/B MuseTalk vs Wav2Lip vs LatentSync on 5 sample faces (Indian, vertical short-form, talking-head)
- Pick winner, integrate into pipeline
- Add remaining 5 languages (Telugu, Marathi, Bengali, Kannada, Bhojpuri)
- Parallelize per-language jobs in BullMQ

**Goal of week 3:** show 4-language output for any uploaded Hindi video.

### Week 4 — Free tier, watermark, billing
- Watermark renderer (FFmpeg overlay)
- Free-tier quota enforcement
- Razorpay UPI Subscription production integration + webhook
- Plan upgrade / downgrade / cancellation flows
- Usage meter UI in dashboard
- Failed-payment retry logic
- DPDP-compliant privacy policy + consent flow at signup (template generator: dpdpact.co.in)

**Goal of week 4:** real money taken from a real creator (even if it's a friend).

### Week 5 — Polish + onboarding
- Onboarding flow: 30-second intro video, sample-dub-on-rails for first upload
- WhatsApp delivery integration via Gupshup (notification when job done)
- Dashboard: jobs list, history, re-download, share to socials
- Quality issues: tighten time-alignment so dub doesn't drift on long videos
- Edge cases: missing audio track, multi-speaker, very short videos (<10 sec)
- Error UX: when Replicate fails, retry once, refund minutes if final fail

**Goal of week 5:** can hand the URL to any random Hindi creator, they self-serve to a paid plan.

### Week 6 — Pre-launch + first 10 paying customers
- Build 10 case-study dub videos for 10 mid-tier Hindi creators (without asking them — surprise gift)
- Cold-DM each on Instagram + email: "I dubbed your last video into 4 languages, here are the links — keep them, no charge. If you want monthly, we're at dubkaroo.com."
- 5 of 10 will reply. 2 will sign up paid. **First MRR.**
- Twitter / X build-in-public thread: pipeline architecture, cost economics, first revenue dollar.
- Submit to Product Hunt as "DubKaroo — vernacular YouTube dubbing for India."

**Goal of week 6:** 10 paying customers, ₹15K MRR.

## 10. Distribution / GTM (90-day plan)

### Phase 1 — Days 1–30: surprise the influencers (free dubs as marketing)
- Identify 50 mid-tier Hindi YouTubers (50K–500K subs) in your top verticals using Social Blade + manual scrape
- Make a free dub of their latest video into 4 languages, host on R2
- Send personalized Instagram DM + email with the links: "Made these for you — no charge. If you want this monthly, here's the link"
- Conversion target: 10–15% sign up free, 3–5% go paid → **5–7 paid customers from 50 outreach**

### Phase 2 — Days 30–60: case study + creator-to-creator referrals
- Pick the 1–2 creators whose dubs got the most regional-language views and propose a co-marketing deal: 6 months free in exchange for one Shorts video saying "I added Tamil/Telugu and got X% more views — DubKaroo did this in 5 minutes"
- Drive referral payout — ₹500 + 1 month free for each new paid signup attributed to a creator
- Submit to **r/IndianYouTubers**, **r/IndianCreators**, **r/IndianTeenagers** with case-study videos

### Phase 3 — Days 60–90: MCN partnerships + paid acquisition
- Pitch Monk Entertainment, Beardo content arm, Nikhil Camera, Wassup India, Maxtern with rev-share onboarding deal — they already manage 50–200 creators each
- First paid Meta ads (Instagram Reels) at ₹100/day max, optimized for free trial signups
- Sponsor one episode of a relevant podcast (e.g., a creator-economy show on YouTube India)
- **Goal at day 90: 50–80 paying customers, ₹1–2L MRR.**

## 11. Legal & compliance

### 11.1 DPDP Act 2023
- Privacy notice + explicit consent at signup. Use dpdpact.co.in's template generator.
- Encryption at rest (R2 default) and in transit (TLS).
- Role-based access logs ≥1 year (Sentry + Postgres audit log table).
- 72-hour breach notification SOP.
- Data Processing Agreement template for any future B2B clients.
- Penalties up to ₹250 Cr — not optional.

### 11.2 Voice cloning (when you ship v2)
- Mandatory voice-consent flow: creator records a specific spoken phrase ("I, [name], authorize DubKaroo to clone my voice for use on my own content uploaded to this account") before the model is trained.
- Store consent recording with timestamp + IP.
- Disable voice clone on plan cancellation.

### 11.3 Copyright on source material
- Terms of service must require creator to confirm they own / are licensed for the source video and all music in it.
- Add "music in source" warning in upload flow — encourage uploading voice-dominant audio.
- DMCA / IT Act takedown SOP (24-hour response window).

### 11.4 YouTube TOS on AI-dubbed content
- YouTube currently requires disclosure for "altered or synthetic content" but explicitly permits AI-dubbed versions of your own content. Add a one-click "How to disclose on YouTube" guide in dashboard.

### 11.5 Company structure
- Pvt Ltd via SPICe+ once you cross 5 paying customers. Don't bother before that.
- Apply for DPIIT Startup recognition (free, 7–14 days) — unlocks 3-year tax holiday.
- Defer GST registration until ~₹15L revenue.

## 12. Risk register & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| MuseTalk lip-sync looks uncanny on Indian faces | Medium | High | Fall back to Wav2Lip for fast tier; offer LatentSync on Pro; collect 1000 face samples to fine-tune by month 6 |
| Sarvam pricing increases 3× | Medium | Medium | Have AI4Bharat self-host fallback ready on Modal; switch costs to ~₹3K/mo extra infra, manageable |
| HeyGen / ElevenLabs ship India-first SKU | High in 12 mo | High | Move fast; build creator loyalty via Indian payment rails + WhatsApp delivery + ₹ pricing; defensible moat is creator-specific voice library by month 12 |
| YouTube changes TOS on AI dubs | Low | Existential | Diversify to Instagram Reels + standalone audio podcast use cases by month 6 |
| Voice-clone IP lawsuit from a celebrity creator | Low | High | v1 ships without voice cloning; v2 requires consent recording; reject onboarding from accounts that aren't the creator |
| GPU cost spikes (Replicate margins squeeze) | Medium | Medium | Migrate to RunPod serverless when MRR > $5K — ~50% cost reduction |
| Creator churn after first 1–2 jobs ("I tried it, didn't help") | Medium | High | Onboarding sample-dub-on-rails to set expectation; show "watch-time lift" widget after each job using YouTube API |
| DPDP enforcement audit | Low (but rising) | High | Build compliance posture from week 1, not retrofit |

## 13. 90-day milestones + 12-month north star

| Day | Milestone |
|---|---|
| 7 | Landing page live + waitlist 100 |
| 14 | First successful end-to-end pipeline run (1 video → 1 language → output) |
| 21 | All 6 languages working with MuseTalk lip-sync |
| 28 | First paid Razorpay subscription (friend / warm contact) |
| 45 | 10 paying customers, ₹15K MRR |
| 60 | 25 paying customers, ₹40K MRR — past breakeven |
| 90 | 60 paying customers, ₹1.2L MRR — first MCN partnership signed |
| 180 | 250 paying customers, ₹5L MRR, voice-cloning v2 shipped |
| 365 | 1,500 paying customers, ₹30–40L MRR, raise seed (Peak XV Surge / Lightspeed / Z47) on creator-economy thesis |

## 14. Post-MVP roadmap (months 4–12)

**v2 (months 4–5): Voice cloning**
- Sarvam voice-clone or ElevenLabs Indic voice clone
- Consent flow + voice library per creator
- This is the single feature most likely to 2× ARPU

**v3 (months 5–6): Adjacent localization**
- Auto-translated titles + descriptions (use Mayura + creator-tunable templates)
- Localized thumbnails (overlay translated text + face crop)
- One-click upload to YouTube via OAuth

**v4 (months 6–9): Other source surfaces**
- Hindi → English (NRI / global audience demand)
- Kannada / Tamil / Telugu source (not just Hindi)
- Long-form support up to 60 min (podcast episodes, webinars)
- Bulk batch upload + API for studios/MCNs

**v5 (months 9–12): Platform play**
- White-label for MCNs (Monk, Wassup India)
- D2C brand SKU: localize product videos for Shopify D2C (Nykaa Style, Mamaearth-tier brands)
- B2B EdTech SKU: dub a Physics Wallah / Vedantu lecture series

## 15. Resources & references

- **Sarvam AI** — [docs.sarvam.ai](https://docs.sarvam.ai/) — Saarika ASR, Mayura translation, Bulbul TTS
- **AI4Bharat** — [ai4bharat.iitm.ac.in](https://ai4bharat.iitm.ac.in/) — IndicTrans2, IndicConformer, IndicTTS (Apache 2.0)
- **MuseTalk** — [github.com/TMElyralab/MuseTalk](https://github.com/TMElyralab/MuseTalk) — Apache 2.0 lip-sync
- **LatentSync** — [github.com/bytedance/LatentSync](https://github.com/bytedance/LatentSync) — premium lip-sync
- **Replicate** — [replicate.com](https://replicate.com/) — easiest GPU inference
- **RunPod Serverless** — [runpod.io](https://runpod.io/) — cheaper GPU for scale
- **Razorpay UPI Subscription** — [razorpay.com/docs/payments/subscriptions/upi](https://razorpay.com/docs/payments/subscriptions/upi/)
- **Cloudflare R2** — [cloudflare.com/products/r2](https://www.cloudflare.com/products/r2/) — zero-egress storage
- **DPDP template** — [dpdpact.co.in](https://dpdpact.co.in/)
- **Gupshup BSP for WhatsApp** — [gupshup.io](https://www.gupshup.io/)

## 16. The single most important thing

**Do not build for 6 weeks then start selling.** Build for 5 days, then start the manual-pipeline outreach in parallel:

- Days 1–5: spin up landing page, manually dub 5 sample videos using Sarvam Studio + free MuseTalk Colab notebook, post side-by-side comparisons.
- Day 6 onwards: parallel-track building the product *and* DM-ing 10 creators per day with manually-produced free dubs.

By the time the product is "ready" at week 6, you should already have 30+ creators who have seen your dubs, 5+ on a free trial, and 1–2 paying. The product is just the automation of work you've already proven creators want.

If after 50 manual dubs no creator has shown enthusiasm, do not finish building — kill it and move to the #2 idea on the shortlist.
