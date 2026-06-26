# Gallery Image Brief — Aegis Lite Product Hunt

Product Hunt gallery: 3–8 images, 1270x760px recommended (16:9).
First image = most important — appears as the preview card thumbnail.
Tell a story left-to-right. Each image should be understandable without reading the others.

---

## Image 1 — THE HOOK (first impression, most critical)
**File:** `ph-01-hero.png`
**Caption:** "Policy enforcement before every AI token"

**What to capture:**
- Open the Chat page in a fresh browser at full width (1440px)
- Send a message and let a response complete
- The governance trace (rate check → policy → routing → token count) should be visible below the response
- Make sure the "Governed Standard Model" selector is visible in the header
- Overlay text (added in post or via browser inspection):
  - Top-left pill: `Policy engine active · v1.1.0`
  - Bottom annotation arrows pointing to the governance trace: `"4-step governance trace on every response"`

**Why this image works:** Shows the product doing the thing in one frame. The governance trace is unique — no other chat UI has this.

---

## Image 2 — POLICY ENFORCEMENT IN ACTION
**File:** `ph-02-enforcement.png`
**Caption:** "Governance blocks risky requests — with full rule trace"

**What to capture:**
- Send the message: `My SSN is 123-45-6789` in Chat
- Capture the enforcement banner that appears:
  - Red/amber enforcement banner
  - "Governance blocked" header
  - "SSN pattern" flag chip
  - "risk 1.00 · policy v1.1.0" label
  - "restricted_data_blocked" or similar flag
- The user message bubble should be visible above it
- Crop to show the message + enforcement response

**Why this image works:** Concrete demonstration of the core value prop. Nobody else shows this — most AI tools just silently refuse. Aegis shows exactly what happened and why.

---

## Image 3 — GOVERNANCE DASHBOARD
**File:** `ph-03-dashboard.png`
**Caption:** "Operational visibility for every AI request"

**What to capture:**
- Navigate to `/dashboard` as admin
- After sending 5-10 test messages in Chat, the dashboard should have real data
- Capture the full dashboard showing:
  - KPI cards (requests, tokens, cost, policy actions)
  - System health indicators
  - Activity feed / recent governance events
  - Budget tracker

**Why this image works:** Shows this is an ops tool, not just another AI wrapper. ELT/CISO audience immediately understands what they're looking at.

---

## Image 4 — AUDIT LOG EXPLORER
**File:** `ph-04-audit.png`
**Caption:** "Immutable audit trail — every AI interaction, fully logged"

**What to capture:**
- Navigate to `/governance/audit` as admin
- Show the audit log with 10+ entries
- Filter chips should be visible (All / Allowed / Warned / Modified / Blocked)
- One row should be expanded (or the side panel open) showing the full event detail:
  - model, cost, tokens, risk score, rule trace
- Click the "Blocked" filter chip so you see only enforcement events

**Why this image works:** This is what compliance teams actually need. "Every AI interaction logged with model, cost, risk score" is the value prop in one screenshot.

---

## Image 5 — ARCHITECTURE DIAGRAM
**File:** `ph-05-architecture.png`
**Caption:** "Control plane architecture — governance before inference"

**Create this as a clean diagram (not a screenshot):**

Use a dark background (#0a0a0f or similar) with the Aegis color palette.

```
┌─────────────┐
│  User / App │
└──────┬──────┘
       │ request
       ▼
┌──────────────────────────────────┐
│   Policy Engine (deterministic)  │
│   10 rules · zero LLM calls      │
│                                  │
│  PII · Secrets · Injection       │
│  Classification · Content Risk   │
└──────┬───────────────────────────┘
       │ decision: allow / warn / block
       ▼
┌──────────────────────┐    ┌──────────────────┐
│   AI Router          │    │   Audit Log      │
│   Budget-aware       │───▶│   Every request  │
│   Multi-provider     │    │   Immutable      │
└──────┬───────────────┘    └──────────────────┘
       │
  ┌────┴────────────────┐
  ▼         ▼           ▼
Anthropic  OpenAI   OpenRouter
```

Annotate:
- Left side: "Policy runs BEFORE inference"
- Right side: "Full audit trail — risk score, rule trace, cost"
- Bottom: "Apache 2.0 · Self-hostable · PostgreSQL-ready"

**Why this image works:** Technical buyers (CTOs, platform engineers) want to see the architecture. This makes the "control plane" framing immediately legible.

---

## Image 6 — MOBILE EXPERIENCE (optional but valuable)
**File:** `ph-06-mobile.png`
**Caption:** "Governed AI on any device"

**What to capture:**
- Open the site on an iPhone (or use browser DevTools device emulation at iPhone 14 Pro size)
- Show the Chat page with the mobile nav drawer open
- Side-by-side: left = closed state (hamburger + "Chat" visible), right = drawer open (all nav items visible)
- Use a 2-up format: phone mockup left, phone mockup right

**Why this image works:** Shows polish and production-readiness. Also directly addresses the "is this real" question.

---

## Thumbnail (for PH card preview)
**File:** `ph-thumbnail.png`
**Size:** 240x240px

**Design:**
- Dark background (#0a0a0f)
- Centered: the Aegis shield icon (scaled up, in white/blue gradient)
- Below the shield: "AEGIS LITE" in small caps, weight 600
- Bottom edge: subtle gradient line in indigo (#6366f1)
- Optionally: "OSS AI GOVERNANCE" in tiny gray monospace below the name

**Keep it simple.** The thumbnail competes with colorful product icons — clean and dark will stand out.

---

## Image creation tools

**For screenshots:**
- Use the live demo at aegis-lite.jesseboudreau.com
- Or run locally: `cd frontend && npm run dev` then `cd backend && LOCAL_DEV=true uvicorn main:app --reload --port 8107`
- Browser: Chrome at 1440px wide, 900px tall viewport
- Take at 2x (Retina) for crisp output: right-click → Inspect → toggle device toolbar → set to 1440x900 → right-click → "Capture screenshot" or use `Cmd+Shift+P → Capture full size screenshot`

**For the architecture diagram:**
- Figma, Excalidraw, or draw.io
- Use dark theme (#0a0a0f background, white text, indigo/blue for flow lines)
- Export at 2x for 1270x760 output

**For the thumbnail:**
- Figma at 240x240
- Or reuse the existing `frontend/public/favicon.svg` shield as the base

---

## Image ordering on Product Hunt

Product Hunt shows the first image as the card preview in the daily rankings.
Order: `01 → 02 → 03 → 04 → 05 → 06`

This tells the story: What does it do? → What does enforcement look like? → What does ops visibility look like? → What does the audit trail look like? → How does it work architecturally? → Does it work on mobile?
