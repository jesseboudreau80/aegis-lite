"""
Public AI assistant — no auth required.
Streaming chat for prospecting/onboarding inbound visitors (PH launch, etc).
Saves leads to .data/assistant_leads.json + optional Slack webhook.
"""
import json
import logging
import os
import time
import uuid
from datetime import datetime

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/assistant", tags=["assistant"])

_OPENROUTER_KEY = os.getenv("OPENROUTER_API_KEY", "")
_SLACK_WEBHOOK  = os.getenv("SLACK_WEBHOOK_URL", "")
_MODELS = [
    "openai/gpt-oss-20b:free",
    "google/gemma-4-31b-it:free",
]

_DATA_DIR  = os.path.join(os.path.dirname(__file__), "..", "..", ".data")
_LEADS_FILE = os.path.join(_DATA_DIR, "assistant_leads.json")

SYSTEM_PROMPT = """You are the AI assistant embedded in Aegis Lite (aegis-lite.jesseboudreau.com), an open-source AI governance platform. Today is the Product Hunt launch day (June 17, 2026). Your job: help visitors understand Aegis Lite, evaluate it for their team, learn how to contribute, or connect with the founder Jesse Boudreau.

ABOUT AEGIS LITE:
An open-source AI governance control plane. The policy enforcement layer that sits between your application and any LLM.

NOT: a chat interface, another AI wrapper, or probabilistic "guardrails"
IS:
- Policy-before-inference: rules enforced deterministically BEFORE the prompt hits the model
- 10-step rule chain: secrets → model access → agent permissions → data classification → PII → injection → sensitive keywords → outbound → tool grants → risk controls
- Full audit trail on every request: rule trace, risk score, policy version, token counts
- Token/tier enforcement, PII redaction, topic blocking, rate limits
- Governance-first design: auditable, testable, reproducible — no LLMs inside the policy engine

Stack: FastAPI + Python 3.12 backend, Next.js 15 + TypeScript + Tailwind frontend
Demo: https://aegis-lite.jesseboudreau.com (login: admin@example.com / demo)
GitHub: https://github.com/jesseboudreau80/aegis-lite (Apache 2.0)

ABOUT JESSE BOUDREAU (the builder):
- 20+ years in operations, compliance, and leadership
- Former national compliance manager at large US pet care chain (190+ locations)
- Built Aegis AI (enterprise version, deployed in production) then open-sourced the core as Aegis Lite
- Philosophy: governance is infrastructure, not a feature
- GitHub: github.com/jesseboudreau80 | LinkedIn: linkedin.com/in/jessejboudreau/
- Contact: jesse.boudreau.dev@gmail.com | jesseboudreau.com/agent

HOW TO ROUTE VISITORS:

Evaluating for their company (CTO, VP Eng, compliance):
- Understand their use case, explain how the policy engine maps to their problem
- Say: "Drop your contact details in the form below and Jesse will follow up within 24 hours."
- Signal lead capture with [SHOW_LEAD_FORM] once in your response

Wants to contribute (OSS developer):
- Welcome them! GitHub: https://github.com/jesseboudreau80/aegis-lite
- Good-first-issues: #1 (unit tests), #2 (IBAN PII detection), #5 (deploy guides), #7 (mobile nav), #11 (OpenRouter models), #15 (Docker Compose)
- Discussions at: https://github.com/jesseboudreau80/aegis-lite/discussions
- Jesse reviews PRs quickly

Product Hunt curious visitor:
- Explain what Aegis Lite is and why governance-first matters
- Share demo link and GitHub
- Ask what they're building with AI

Wants to integrate or partner:
- Understand what they're building, then signal [SHOW_LEAD_FORM]

General questions about how it works:
- Explain the policy engine honestly: 10 deterministic rules, risk score, full trace
- You ARE inside the Aegis Lite app right now — they can click "Try workspace" on the landing page to see the actual product

RESPONSE RULES:
- Under 200 words unless detail is clearly needed
- Use markdown: **bold**, bullet lists, [links](url)
- Don't invent pricing — Jesse handles commercial conversations
- Include [SHOW_LEAD_FORM] exactly once when enterprise/partner/consulting intent is detected (UI strips it and shows the contact form)
- After 2 or more exchanges in the conversation, if the visitor hasn't been offered a way to connect with Jesse yet, proactively offer it — e.g. "Want to connect with Jesse directly? Drop your details below and he'll follow up within 24 hours." — and include [SHOW_LEAD_FORM]
- Be direct and specific — this is a real, deployed product, not vaporware
- End EVERY response with exactly this format on its own line: [SUGGEST: Question one | Question two] — 2 short follow-up questions (max 8 words each) the visitor might want to ask next, phrased as if the visitor is asking. The UI renders these as clickable chips, never show this token in plain text."""


class ChatRequest(BaseModel):
    messages: list[dict]


class LeadRequest(BaseModel):
    name: str = ""
    email: str
    org: str = ""
    intent: str = ""
    source: str = "aegis-lite-assistant"


@router.post("/chat")
async def assistant_chat(req: ChatRequest, request: Request):
    messages = req.messages[-12:]  # cap history
    full_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + messages

    headers = {
        "Authorization": f"Bearer {_OPENROUTER_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://aegis-lite.jesseboudreau.com",
        "X-Title": "Aegis Lite Assistant",
    }

    async def generate():
        t0 = time.monotonic()
        for model in _MODELS:
            try:
                async with httpx.AsyncClient(timeout=45.0) as client:
                    async with client.stream(
                        "POST",
                        "https://openrouter.ai/api/v1/chat/completions",
                        headers=headers,
                        json={
                            "model": model,
                            "messages": full_messages,
                            "max_tokens": 550,
                            "stream": True,
                            "temperature": 0.7,
                        },
                    ) as resp:
                        if resp.status_code != 200:
                            continue
                        async for line in resp.aiter_lines():
                            if not line:
                                continue
                            if line.startswith("data: "):
                                payload = line[6:]
                                if payload.strip() == "[DONE]":
                                    ms = int((time.monotonic() - t0) * 1000)
                                    short = model.split("/")[-1].replace(":free", "")
                                    yield f"data: {json.dumps({'_meta': {'model': short, 'ms': ms}})}\n\n"
                                    yield "data: [DONE]\n\n"
                                    return
                                try:
                                    chunk = json.loads(payload)
                                    content = chunk["choices"][0]["delta"].get("content", "")
                                    if content:
                                        yield f"data: {json.dumps({'t': content})}\n\n"
                                except Exception:
                                    pass
                        ms = int((time.monotonic() - t0) * 1000)
                        short = model.split("/")[-1].replace(":free", "")
                        yield f"data: {json.dumps({'_meta': {'model': short, 'ms': ms}})}\n\n"
                        yield "data: [DONE]\n\n"
                        return
            except Exception as exc:
                logger.warning("assistant_chat model %s failed: %s", model, exc)
                continue

        fallback = "I'm temporarily unavailable. Email Jesse at **jesse.boudreau.dev@gmail.com** or visit [jesseboudreau.com/agent](https://jesseboudreau.com/agent)."
        yield f"data: {json.dumps({'t': fallback})}\n\n"
        ms = int((time.monotonic() - t0) * 1000)
        yield f"data: {json.dumps({'_meta': {'model': 'unavailable', 'ms': ms}})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/lead")
async def assistant_lead(req: LeadRequest):
    if not req.email.strip():
        return {"ok": False, "error": "Email required"}

    lead = {
        "id": str(uuid.uuid4()),
        "ts": datetime.utcnow().isoformat() + "Z",
        "name": req.name.strip(),
        "email": req.email.strip().lower(),
        "org": req.org.strip(),
        "intent": req.intent.strip(),
        "source": req.source,
    }

    try:
        os.makedirs(_DATA_DIR, exist_ok=True)
        try:
            with open(_LEADS_FILE, "r") as f:
                leads = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            leads = []
        leads.append(lead)
        with open(_LEADS_FILE, "w") as f:
            json.dump(leads, f, indent=2)
        logger.info("assistant lead: %s (%s)", lead["email"], lead["org"] or "—")
    except Exception as exc:
        logger.warning("Failed to persist assistant lead: %s", exc)

    if _SLACK_WEBHOOK:
        try:
            parts = ["🎯 *New lead — Aegis Lite assistant*", f"*{lead['name'] or 'Anonymous'}* · {lead['email']}"]
            if lead["org"]:
                parts[1] += f" · _{lead['org']}_"
            if lead["intent"]:
                parts.append(lead["intent"])
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(_SLACK_WEBHOOK, json={"text": "\n".join(parts)})
        except Exception:
            pass

    return {"ok": True}
