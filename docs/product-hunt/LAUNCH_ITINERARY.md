# Product Hunt Launch Itinerary — Aegis Lite

**Target launch date:** Tuesday June 30 or Wednesday July 1, 2026
**Why:** Highest PH traffic days. Original June 17/18 window missed — use next strong Tuesday/Wednesday.

---

## What's changed since the original plan

- Mobile navigation drawer fully rebuilt (iOS Safari portal fix)
- AI routing fixed — free-tier OpenRouter models now work without API key configuration
- Full mobile layout rewrite on agents page (full-width touch cards, no sidebar)
- AegisBadge uses real shield image, hidden on mobile
- AssistantWidget hidden on mobile to prevent overlay
- `/knowledge` placeholder copy corrected to governance context
- Backend policy engine and audit logging verified working
- Demo environment confirmed stable: agents, chat, governance dashboard all live

**Issue count:** 17 issues in `docs/github-issues/` (updated from original 15)

---

## Pre-Launch Checklist (Complete before T-24h)

### GitHub
- [ ] All 17 issues published on GitHub with correct labels
- [ ] `good-first-issue` label: #1, #2, #4, #5, #7, #8, #15, #16, #17
- [ ] `help-wanted` label: #3, #6, #9, #11, #14
- [ ] README screenshots current (check `.github/assets/`)
- [ ] Live demo URL confirmed in README and GitHub About section
- [ ] GitHub Discussions enabled
- [ ] Repo pinned to profile
- [ ] CONTRIBUTING.md in root ✅

### Demo environment
- [ ] `aegis-lite.jesseboudreau.com` up and responsive
- [ ] Login credentials: `admin@example.com` / `demo` and `demo@example.com` / `demo`
- [ ] Policy enforcement: send "My SSN is 123-45-6789" in chat → enforcement banner fires
- [ ] Streaming chat works end-to-end (OpenRouter fallback active if no Anthropic key)
- [ ] Governance dashboard loads with real data
- [ ] Mobile: test on iPhone Safari + Android Chrome (hamburger drawer, agents full-width)
- [ ] `systemctl status aegis-lite-api.service aegis-lite-web.service` — both active

### Product Hunt assets
- [ ] Thumbnail: 240×240 (use `/public/aegis-shield.png` cropped to square, or `/public/aegis-shield-sm.webp`)
- [ ] Gallery image 1: Governed chat with policy trace (`.github/assets/governed-chat.png`)
- [ ] Gallery image 2: Governance dashboard (`.github/assets/governance-dashboard.png`)
- [ ] Gallery image 3: Agent arena / pantheon (`.github/assets/agents-pantheon.png`)
- [ ] Gallery image 4: Policy rules view (`.github/assets/policy-rules.png`)
- [ ] Gallery image 5 (optional): Mobile view or executive overview
- [ ] All gallery images at 1280×800px minimum

### Network activation (T-48h)
- [ ] DM 20 most engaged Twitter/X followers with heads-up
- [ ] "Launching soon" teaser on LinkedIn
- [ ] "Watch this space" tweet
- [ ] DM 5-10 GitHub followers who star AI/OSS projects
- [ ] Post in relevant Slack/Discord communities (AI governance, security, DevOps)
- [ ] Tell 3-5 people in AI compliance/governance roles personally

---

## Launch Day — Hour by Hour

### 11:45 PM PST (night before)
- Confirm demo site: `curl -s https://aegis-lite.jesseboudreau.com/api/health`
- Open MAKER_COMMENT.md — ready to paste
- Open SOCIAL_SCRIPTS.md — Twitter thread ready
- 3-5 friends confirmed and ready to upvote at midnight

### 12:01 AM PST — LAUNCH
1. Submit listing (or use pre-scheduled)
2. Post Maker Comment immediately (from MAKER_COMMENT.md)
3. Text/DM 5 closest supporters: "We're live — [link] — upvote if you can"

### 12:05 AM PST
4. Post Twitter/X thread (first 3 tweets minimum)
5. Update Twitter bio with PH link

### 12:15 AM PST
6. LinkedIn post (shorter version)
7. Submit to Hacker News: "Show HN: Aegis Lite — open-source AI governance control plane"

### 12:30 AM PST
8. Relevant Slack/Discord communities
9. Reply to any early PH comments

### 6:00 AM PST
- Check rank — in top 10?
- Reply to every overnight comment
- Re-engage Twitter

### 9:00 AM PST (peak traffic)
- Active on PH — reply within 5 minutes
- "First time seeing this?" tweet with quick summary
- If top 5: post "we're trending"

### 12:00 PM PST (midday)
- Mid-day update tweet: rank, what comments are saying
- LinkedIn update comment
- Respond to HN thread

### 3:00 PM PST (afternoon sustain)
- Final community push
- DM tech journalists / newsletter authors personally
- Respond to all outstanding PH comments

### 6:00 PM PST (wind-down)
- Day 1 recap tweet
- GitHub check: stars/forks/issues opened

### End of Day
- Screenshot final PH card
- Write brief "launch day notes"

---

## Key metrics

| Metric | Target | Check at |
|---|---|---|
| PH upvotes | 200+ (top 5 trending) | Hourly |
| PH comments | 20+ | Hourly |
| GitHub stars | +50 launch day | 3× day |
| GitHub forks | +10 launch day | EOD |
| Demo logins | +100 sessions | EOD |
| New issues opened | 5+ | EOD |
| Twitter impressions | 10K+ thread | EOD |

---

## If not trending by 9 AM PST

1. DM 10 more people in your network
2. Post in 2-3 more communities you haven't hit
3. Engage with other top products on PH (visibility play)
4. Check thumbnail clarity and tagline punch — you can edit early

Top 5 = 300-800 upvotes. Top 10 = 100-300 upvotes, still strong for OSS (GitHub stars matter more long-term).

---

## Post-Launch (Week 1)

- [ ] Blog post: "Why I built an open-source AI governance layer" — jesseboudreau.com + Dev.to/Hashnode
- [ ] Submit to: TLDR Newsletter, Console.dev, Software Lead Weekly, Hacker Newsletter
- [ ] Launch recap on LinkedIn with key stats
- [ ] Thank commenters who gave substantial feedback
- [ ] Merge first community PR — celebrate publicly
- [ ] Open GitHub Discussion: "What governance rules should we add next?"

---

## Important notes

**DO NOT:**
- Ask people to upvote in PH comments (against TOS)
- Use vote-ring services (gets delisted)
- Launch Monday, Friday, Saturday, or Sunday

**DO:**
- Engage authentically with every comment
- Be honest about what's not done yet (builds credibility)
- Respond to criticism thoughtfully — visible to everything
- Share the PH link directly — make it easy

---

## Personal outreach list (fill before launch)

- [ ] AI governance / compliance practitioners who follow you
- [ ] OSS contributors in your network
- [ ] Security engineers you know
- [ ] DevOps / platform engineers building AI tooling
- [ ] CTOs / VPs Eng interested in AI governance
- [ ] Journalists / newsletter authors covering AI infrastructure
