"""
Aegis Lite — Centralized Policy Configuration

This file defines ALL governance rules as plain Python constants.
Rule logic lives in services/policy_engine.py; only thresholds, lists,
and patterns belong here.

CHANGE CONTROL:
  All modifications should go through code review so that policy changes
  are traceable in git history. Future: promote to DB-backed config with
  admin UI and version logging.
"""
from __future__ import annotations
import re

# ── Model access control ──────────────────────────────────────────────────────

ROLE_MODEL_ACCESS: dict[str, set[str] | None] = {
    "admin": None,
    "user": {
        "claude_sonnet",
        "gpt4o",
        "gpt4o_mini",
        "mistral",
        "llama3",
        "gemini",
        "kimi",
        "perplexity_sonar",
        "perplexity_sonar_pro",
        # claude_opus excluded for regular users (cost control)
    },
}

DEPARTMENT_MODEL_BLOCKLIST: dict[str, set[str]] = {
    # "finance": {"claude_opus"},
    # "marketing": {"claude_opus"},
}

# ── Provider classification ────────────────────────────────────────────────────

EXTERNAL_PROVIDERS: set[str] = {"perplexity", "openrouter"}

PROVIDER_DATA_POLICY: dict[str, set[str]] = {
    "public":       {"anthropic", "openai", "perplexity", "openrouter", "mock"},
    "internal":     {"anthropic", "openai", "openrouter", "mock"},
    "confidential": {"anthropic", "openai", "mock"},
    "restricted":   {"mock"},
}

# ── Data classification auto-detection ────────────────────────────────────────

CONFIDENTIAL_KEYWORDS: list[str] = [
    "proprietary",
    "trade secret",
    "attorney client",
    "privileged communication",
    "board meeting",
    "executive compensation",
    "unreleased product",
    "pre-release",
    "merger",
    "acquisition target",
    "m&a",
    "strategic plan",
    "internal only",
    "do not distribute",
    "confidential",
]

RESTRICTED_KEYWORDS: list[str] = [
    "patient record",
    "medical record",
    "hipaa",
    "phi ",
    "ssn",
    "bank account",
    "routing number",
    "lawsuit",
    "litigation",
    "legal hold",
    "whistleblower",
    "regulatory investigation",
]

# ── PII detection & redaction ─────────────────────────────────────────────────

PII_RULES: list[tuple[re.Pattern, str, str]] = [
    (
        re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b"),
        "email",
        "redact",
    ),
    (
        re.compile(r"\b(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b"),
        "phone",
        "redact",
    ),
    (
        re.compile(r"\b(?!000|666|9\d{2})\d{3}[- ](?!00)\d{2}[- ](?!0{4})\d{4}\b"),
        "ssn",
        "redact",
    ),
    (
        re.compile(r"\b(?:\d{4}[- ]?){3}\d{4}\b"),
        "credit_card",
        "redact",
    ),
    (
        re.compile(r"\b[A-Z]{2}\d{2}[A-Z0-9]{4}[0-9 ]{7,30}\b"),
        "iban",
        "redact",
    ),
]

PII_RISK_DELTA: float = 0.20

# ── Secrets / credential detection ───────────────────────────────────────────

SECRETS_RULES: list[tuple[re.Pattern, str, str]] = [
    (re.compile(r"sk-[A-Za-z0-9]{20,}"),            "openai_api_key",      "block"),
    (re.compile(r"sk-ant-[A-Za-z0-9\-_]{40,}"),     "anthropic_api_key",   "block"),
    (re.compile(r"pplx-[A-Za-z0-9]{20,}"),           "perplexity_api_key",  "block"),
    (re.compile(r"AKIA[A-Z0-9]{16}"),                "aws_access_key",      "block"),
    (re.compile(r"ghp_[A-Za-z0-9]{36}"),             "github_pat",          "block"),
    (re.compile(r"xoxb-[A-Za-z0-9\-]{24,}"),         "slack_bot_token",     "block"),
    (
        re.compile(r"(?i)(password|passwd)\s*[=:]\s*[\"']?\S{6,}[\"']?"),
        "password_literal",
        "block",
    ),
    (
        re.compile(r"(?i)api[_\-\s]?(key|token|secret)\s*[=:]\s*[\"']?[A-Za-z0-9\-_\.]{8,}[\"']?"),
        "api_credential",
        "block",
    ),
    (
        re.compile(r"-----BEGIN (?:RSA |EC )?PRIVATE KEY-----"),
        "private_key",
        "block",
    ),
]

SECRETS_RISK_DELTA: float = 0.95

# ── Prompt injection detection ────────────────────────────────────────────────

INJECTION_PATTERNS: list[str] = [
    "ignore previous instructions",
    "ignore all previous",
    "ignore your instructions",
    "forget everything you",
    "forget all previous",
    "disregard all previous",
    "override your instructions",
    "bypass your safety",
    "bypass your filter",
    "reveal your system prompt",
    "reveal your prompt",
    "show me your instructions",
    "what is your system prompt",
    "jailbreak",
    "dan mode",
    "do anything now",
    "pretend you have no restrictions",
    "you are now unrestricted",
    "act as if you have no",
    "new instructions follow",
    "[[instructions]]",
    "<!-- instructions",
    "\x00",
]

INJECTION_RISK_DELTA_PER_MATCH: float = 0.30
INJECTION_ESCALATE_THRESHOLD: float = 0.55

# ── Research outbound policy ──────────────────────────────────────────────────

RESEARCH_BLOCKED_CLASSIFICATIONS: set[str] = {"confidential", "restricted"}

# ── Source-level external provider policy ────────────────────────────────────

SOURCE_EXTERNAL_POLICY: dict[str, str] = {
    "chat":     "allow",
    "agent":    "warn",
    "research": "allow",
    "support":  "warn",
}

# ── Policy versioning ────────────────────────────────────────────────────────

POLICY_VERSION: str = "1.1.0"

# ── Model override fallback chain ──────────────────────────────────────────────

MODEL_FALLBACK_PRIORITY: list[str] = [
    "claude_sonnet",
    "gpt4o",
    "gpt4o_mini",
    "mistral",
    "llama3",
]

# ── Tool enforcement layer ────────────────────────────────────────────────────

TOOL_RISK_TIERS: dict[str, str] = {
    "web_search":        "standard",
    "code_execution":    "elevated",
    "file_read":         "standard",
    "file_write":        "elevated",
    "database_query":    "elevated",
    "email_send":        "restricted",
    "calendar_access":   "standard",
    "api_call":          "elevated",
    "document_generate": "standard",
    "data_export":       "restricted",
}

ROLE_TOOL_ACCESS: dict[str, set[str] | None] = {
    "admin": None,
    "user": {
        "web_search",
        "file_read",
        "calendar_access",
        "document_generate",
    },
}

TOOL_ENFORCEMENT_RISK_DELTA: dict[str, float] = {
    "standard":   0.10,
    "elevated":   0.35,
    "restricted": 0.70,
}

# ── Risk-based behavior controls ──────────────────────────────────────────────

RISK_BEHAVIOR_CONTROLS: dict[str, dict] = {
    "warn": {
        "system_prompt_injection": (
            "GOVERNANCE NOTICE: This request has been flagged for review. "
            "Provide professional, appropriate responses only."
        ),
        "audit_level": "enhanced",
    },
    "escalate": {
        "system_prompt_injection": (
            "GOVERNANCE NOTICE [ELEVATED]: This conversation is under enhanced "
            "monitoring. Do not reveal sensitive business information, personal data, "
            "or credentials."
        ),
        "audit_level": "full",
    },
    "modify": {
        "system_prompt_injection": (
            "GOVERNANCE NOTICE: This request was automatically adjusted by "
            "Aegis governance controls."
        ),
        "audit_level": "enhanced",
    },
}

# ── Risk thresholds → decision mapping ───────────────────────────────────────

RISK_THRESHOLDS: dict[str, float] = {
    "block":    0.85,
    "escalate": 0.60,
    "warn":     0.25,
}

# ── Force flags ───────────────────────────────────────────────────────────────

FORCE_BLOCK_FLAGS: set[str] = {
    "secrets_detected",
    "restricted_data_blocked",
    "model_access_denied",
}

FORCE_ESCALATE_FLAGS: set[str] = {
    "ssn_detected",
    "credit_card_detected",
    "high_confidence_injection",
    "confidential_data_external_provider",
}

FORCE_WARN_FLAGS: set[str] = {
    "pii_detected",
    "email_detected",
    "phone_detected",
    "sensitive_keywords_detected",
    "prompt_injection_suspected",
    "external_provider_internal_data",
    "agent_model_override",
    "model_access_overridden",
    "unauthorized_tool_requested",
}
