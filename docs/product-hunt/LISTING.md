# Product Hunt Listing Copy — Aegis Lite

---

## Name
**Aegis Lite**

---

## Tagline (60 chars max — pick one)

**Primary (recommended):**
> The open-source AI governance control plane

**Alternatives:**
> Policy enforcement before every AI token — open source
> Govern AI requests before they reach the model. OSS.
> Open-source AI governance: policy, audit, control

---

## Topics / Tags
`Artificial Intelligence` · `Open Source` · `Developer Tools` · `Security` · `Enterprise` · `Productivity`

---

## Short description (260 chars — for PH listing body)

Aegis Lite sits between your users and your AI providers. Every request runs through a deterministic 10-rule policy engine — PII detection, secrets scanning, injection defense, data classification — before a single token is dispatched. Audit log on everything. Apache 2.0. Self-hostable.

---

## Long description (for PH "About" / pitch section)

### The problem

Every team deploying AI is making the same bet: that the model will behave, the provider won't leak data, and the user won't accidentally send credentials or PII. That bet fails in production.

The tools that exist to address this are either vendor-locked (AWS Bedrock Guardrails, Azure Content Safety) or built for ML researchers, not operators.

**Aegis Lite is the open-source answer to the question every CISO is already asking: "What governance controls do we actually have on our AI stack?"**

---

### What Aegis Lite does

Every AI request flows through a control plane before inference:

```
User prompt
    → [Policy Engine: 10 rules, deterministic, zero LLM calls]
    → [Decision: allow / warn / modify / escalate / block]
    → [AI Router: budget-aware, multi-provider]
    → [Provider: Anthropic / OpenAI / OpenRouter / Perplexity]
    → [Response]
         ↓
    [Audit Log: model, cost, tokens, policy decision, risk score, rule trace]
```

**What the policy engine catches:**
- PII (email, phone, SSN, credit card, passport)
- Secrets and credentials (9 pattern classes)
- Prompt injection (21 attack classes)
- Data classification violations (confidential data → external provider)
- High-risk content categories

**Every request produces:**
- A governance decision with risk score (0.0–1.0)
- A full rule trace (which rules fired, in what order)
- An immutable audit record
- Real-time telemetry visible in the governance dashboard

---

### What's included

| Capability | Description |
|---|---|
| Policy Engine | 10-rule deterministic chain. No LLM calls in evaluation. |
| Governed Chat | Streaming inference with live governance trace visible to users |
| Governed Agents | Pre-built + custom agents with model allowlists and budget limits |
| Governed Research | Web-grounded research with pre-dispatch data classification |
| Multi-provider Routing | Anthropic, OpenAI, OpenRouter, Perplexity — budget-aware fallback |
| Audit Log | Every request: model, cost, tokens, decision, risk score |
| Governance Dashboard | Operational view: system health, cost ledger, activity feed |
| Executive View | Board-ready KPIs: policy actions, budget utilization, top contributors |
| Playbooks | Governed AI workflow templates with pre-approved models |
| Knowledge Library | Save and publish AI-generated outputs as org knowledge assets |
| Team Workspaces | Scoped environments with budget limits per team/department |
| RBAC | Role-based model access (admin / user separation) |
| Training Gate | Required governance orientation before AI access is granted |

---

### Who this is for

- **Engineering teams** deploying AI internally who need audit trails and policy controls
- **Security / compliance teams** building evidence for AI governance policies
- **AI platform teams** who need a control plane, not just another SDK wrapper
- **OSS contributors** who want to work on real governance infrastructure

---

### Why open source

The governance layer for AI should not be owned by a single vendor. Every cloud provider and AI company has financial incentives to make their guardrails look good and their competitors' look insufficient. The control plane for how your organization uses AI should be auditable, forkable, and community-owned.

---

### Live demo

[aegis-lite.jesseboudreau.com](https://aegis-lite.jesseboudreau.com)

Login: `admin@example.com` / `demo`

Try sending `My SSN is 123-45-6789` in Chat to see enforcement in action. Watch the 4-step governance trace appear on every response.

---

### Built by

Jesse Boudreau — built the enterprise AI governance platform first, then open-sourced the core. Apache 2.0.

GitHub: [github.com/jesseboudreau80/aegis-lite](https://github.com/jesseboudreau80/aegis-lite)

---

## Links
- **Website / Demo:** https://aegis-lite.jesseboudreau.com
- **GitHub:** https://github.com/jesseboudreau80/aegis-lite
- **Docs / Quick Start:** https://github.com/jesseboudreau80/aegis-lite/blob/main/docs/SETUP.md
