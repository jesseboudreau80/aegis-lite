# Aegis Lite — Product Hunt Launch Kit

Everything needed to execute the launch. Work through these in order.

---

## Files in this directory

| File | What it is | When to use |
|---|---|---|
| [`LISTING.md`](LISTING.md) | Tagline, descriptions, all copy for the PH listing | When setting up the PH submission |
| [`MAKER_COMMENT.md`](MAKER_COMMENT.md) | The pinned maker comment + Q&A templates | Post within 60 seconds of going live |
| [`LAUNCH_ITINERARY.md`](LAUNCH_ITINERARY.md) | Hour-by-hour launch day plan + pre-launch checklist | Read 48h before launch, follow on launch day |
| [`GALLERY.md`](GALLERY.md) | Screenshot brief — what to capture, in what order, and why | Create gallery images before launch |
| [`SOCIAL_SCRIPTS.md`](SOCIAL_SCRIPTS.md) | Twitter/X thread, LinkedIn post, HN submission, community posts | Copy-paste on launch day |
| [`OUTREACH.md`](OUTREACH.md) | DM and email templates for personal network activation | Send T-24h and launch day |

---

## Pre-launch health check

```bash
bash scripts/launch-check.sh
```

Run this the evening before launch and again 30 minutes before going live.
All checks must pass before submitting to Product Hunt.

---

## The three things that determine success

**1. The maker comment** — post it within 60 seconds of the listing going live. It's the first thing every visitor reads. The template is in [`MAKER_COMMENT.md`](MAKER_COMMENT.md).

**2. Early velocity** — the first 2 hours of upvotes drive your position in the daily rankings. Have 10 people confirmed and ready to upvote the moment you launch. Not later that morning — the moment it goes live.

**3. Gallery image 1** — it's the thumbnail on the PH card. Every person browsing the daily list sees it. It must show the product doing something specific and compelling, not a logo or a hero image. See [`GALLERY.md`](GALLERY.md).

---

## Key positioning for Jesse

The credibility story that distinguishes this launch from every other AI OSS tool:

- Built the **enterprise version first** — Aegis AI is deployed and running
- Open-sourced the **core control plane**, not a toy version
- **Governance-first** by design, not security bolted on after
- The policy engine is **deterministic** — auditable, traceable, testable
- Running in production at aegis-lite.jesseboudreau.com — this is **v1.0 real**, not a preview

This is not "another AI wrapper." This is infrastructure.

---

## Target outcome

| Metric | Target |
|---|---|
| PH upvotes | 200+ (top 5 trending) |
| GitHub stars from launch | +100 on launch day |
| New contributors (issues / PRs) | 5+ in first week |
| Demo sessions | 500+ on launch day |
| OSS newsletter pickups | 2+ within 1 week |

---

## Launch date recommendation

**Tuesday June 17 or Wednesday June 18, 2026**

Tuesday and Wednesday have the highest Product Hunt traffic. Avoid Monday (cold start), Friday, and weekends (low engagement, no team upvoting).

Launch at **12:01 AM Pacific** (8:01 AM UTC) to maximize the full 24-hour window.
