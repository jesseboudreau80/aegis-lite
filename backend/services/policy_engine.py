"""
Aegis Lite — Policy Engine

Central governance decision layer. Evaluates every LLM request and response
against the rule set defined in config/policy_config.py.

DESIGN PRINCIPLES
─────────────────
1. Deterministic first — Phase 1 rules are pure regex/keyword matching.
   No LLM calls inside the engine. Phase 2 can layer AI-assisted evaluation
   on top by extending evaluate_request_ai() without changing this interface.

2. Stateless engine — PolicyEngine holds no mutable state. The singleton
   `policy_engine` is safe to share across async workers.

3. Append-only trace — every rule that fires is recorded in rule_trace for
   full audit reproducibility.

4. Non-breaking — a PolicyDecision of "allow" (the default) changes nothing
   downstream. All callers must handle "block" by raising HTTP 403.

EXTENSION GUIDE
───────────────
To add a new Phase 1 rule:
  1. Add constants to config/policy_config.py
  2. Add a method _check_<name>(self, context, state) on PolicyEngine
  3. Call it from evaluate_request() or evaluate_response()

To add Phase 2 AI-assisted evaluation:
  1. Implement evaluate_request_ai(context) → PolicyDecision (async)
  2. Merge its decision into evaluate_request() — never lower Phase 1 risk
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

from config import policy_config as cfg

logger = logging.getLogger(__name__)


# ── Domain objects ─────────────────────────────────────────────────────────────

@dataclass
class PolicyContext:
    user_id: str
    user_role: str
    user_email: str
    model_requested: str
    provider: str
    prompt: str

    source: str = "chat"
    department: Optional[str] = None
    agent_id: Optional[str] = None
    agent_slug: Optional[str] = None
    agent_type: Optional[str] = None
    agent_allowed_models: Optional[list] = None
    agent_budget_limit: Optional[float] = None
    agent_tool_grants: Optional[list] = None
    tools_requested: Optional[list] = None
    data_classification: str = "internal"
    session_id: Optional[str] = None
    metadata: dict = field(default_factory=dict)

    registry_system_id: Optional[str] = None
    registry_system_name: Optional[str] = None
    registry_system_risk_level: Optional[str] = None
    registry_system_department: Optional[str] = None
    registry_system_use_case: Optional[str] = None


@dataclass
class PolicyDecision:
    decision: str                        # allow | modify | warn | block | escalate
    reason: str
    risk_score: float

    modified_prompt: Optional[str] = None
    modified_response: Optional[str] = None
    overridden_model: Optional[str] = None

    flags: list = field(default_factory=list)
    tools_blocked: list = field(default_factory=list)
    requires_human_review: bool = False
    rule_trace: list = field(default_factory=list)

    policy_version: str = ""
    system_prompt_injection: Optional[str] = None
    audit_level: str = "standard"


class PolicyBlockedError(Exception):
    """Raised by call_model() when the policy engine returns decision="block"."""
    def __init__(self, decision: PolicyDecision):
        self.decision = decision
        super().__init__(decision.reason)


# ── Internal evaluation state ──────────────────────────────────────────────────

@dataclass
class _State:
    risk_score: float = 0.0
    flags: list = field(default_factory=list)
    rule_trace: list = field(default_factory=list)
    prompt_redacted: Optional[str] = None
    response_redacted: Optional[str] = None
    effective_classification: str = "internal"
    overridden_model: Optional[str] = None
    tools_blocked: list = field(default_factory=list)
    system_prompt_injection: Optional[str] = None
    audit_level: str = "standard"

    def add(self, rule: str, flag: str, risk_delta: float, note: str = "") -> None:
        self.risk_score = min(1.0, self.risk_score + risk_delta)
        if flag not in self.flags:
            self.flags.append(flag)
        self.rule_trace.append({
            "rule":       rule,
            "flag":       flag,
            "risk_delta": risk_delta,
            "note":       note,
        })

    def resolve_decision(self) -> tuple[str, str]:
        for flag in self.flags:
            if flag in cfg.FORCE_BLOCK_FLAGS:
                return "block", f"Policy rule triggered: {flag}"

        for flag in self.flags:
            if flag in cfg.FORCE_ESCALATE_FLAGS:
                return "escalate", f"Escalation required: {flag}"

        if self.risk_score >= cfg.RISK_THRESHOLDS["block"]:
            return "block", f"Cumulative risk score {self.risk_score:.2f} exceeds block threshold"
        if self.risk_score >= cfg.RISK_THRESHOLDS["escalate"]:
            return "escalate", f"Risk score {self.risk_score:.2f} requires escalation review"
        if self.risk_score >= cfg.RISK_THRESHOLDS["warn"]:
            return "warn", f"Risk score {self.risk_score:.2f} — proceed with caution"

        warn_flags = [f for f in self.flags if f in cfg.FORCE_WARN_FLAGS]
        if warn_flags:
            return "warn", f"Flagged for review: {', '.join(warn_flags)}"

        return "allow", "All policy checks passed"

    def to_decision(self, modified_prompt=None, modified_response=None) -> PolicyDecision:
        decision, reason = self.resolve_decision()

        effective_prompt   = modified_prompt   or self.prompt_redacted
        effective_response = modified_response or self.response_redacted

        if decision == "warn" and (
            effective_prompt is not None
            or effective_response is not None
            or self.overridden_model is not None
        ):
            decision = "modify"
            changed = []
            if self.overridden_model:
                changed.append(f"model overridden to {self.overridden_model}")
            redacted = [f for f in self.flags if "_detected" in f]
            if redacted:
                changed.append(f"content redacted: {', '.join(redacted)}")
            reason = "; ".join(changed) if changed else "Request adjusted by policy"

        return PolicyDecision(
            decision=decision,
            reason=reason,
            risk_score=round(self.risk_score, 4),
            modified_prompt=effective_prompt,
            modified_response=effective_response,
            overridden_model=self.overridden_model,
            flags=list(self.flags),
            tools_blocked=list(self.tools_blocked),
            requires_human_review=decision in ("block", "escalate"),
            rule_trace=list(self.rule_trace),
            policy_version=cfg.POLICY_VERSION,
            system_prompt_injection=self.system_prompt_injection,
            audit_level=self.audit_level,
        )


# ── Policy Engine ──────────────────────────────────────────────────────────────

class PolicyEngine:
    """
    Stateless, synchronous rule evaluator.
    All public methods are marked async to allow Phase 2 AI-assisted
    evaluation to be added without changing the interface.
    """

    async def evaluate_request(self, context: PolicyContext) -> PolicyDecision:
        state = _State(effective_classification=context.data_classification)

        self._check_secrets(context.prompt, state, "request")
        self._check_model_access(context, state)
        self._check_agent_permissions(context, state)
        self._check_data_classification(context, state)
        self._check_pii(context.prompt, state, "request")
        self._check_prompt_injection(context, state)
        self._check_sensitive_keywords(context.prompt, state)
        self._check_research_outbound(context, state)
        self._check_tool_grants(context, state)
        self._apply_risk_behavior_controls(state)

        return state.to_decision()

    async def evaluate_response(self, context: PolicyContext, response: str) -> PolicyDecision:
        state = _State(effective_classification=context.data_classification)
        self._check_secrets(response, state, "response")
        self._check_pii(response, state, "response")
        return state.to_decision()

    async def evaluate_request_ai(self, context: PolicyContext) -> PolicyDecision:
        """Phase 2 — AI-assisted evaluation (not yet implemented)."""
        raise NotImplementedError("AI-assisted policy evaluation is Phase 2.")

    # ── Rule implementations ──────────────────────────────────────────────────

    def _check_secrets(self, text: str, state: _State, context_label: str) -> None:
        for pattern, label, _action in cfg.SECRETS_RULES:
            if pattern.search(text):
                state.add("secrets_detection", "secrets_detected", cfg.SECRETS_RISK_DELTA,
                          f"{label} pattern matched in {context_label}")
                if context_label == "response":
                    state.response_redacted = pattern.sub(f"[REDACTED_{label.upper()}]", text)
                break

    def _find_fallback_model(self, context: PolicyContext) -> Optional[str]:
        if context.agent_allowed_models:
            for m in cfg.MODEL_FALLBACK_PRIORITY:
                if m in context.agent_allowed_models:
                    return m
            return context.agent_allowed_models[0]

        role_allowed = cfg.ROLE_MODEL_ACCESS.get(context.user_role)
        if role_allowed is not None:
            for m in cfg.MODEL_FALLBACK_PRIORITY:
                if m in role_allowed:
                    return m

        return cfg.MODEL_FALLBACK_PRIORITY[0]

    def _check_model_access(self, context: PolicyContext, state: _State) -> None:
        allowed = cfg.ROLE_MODEL_ACCESS.get(context.user_role)
        if allowed is not None and context.model_requested not in allowed:
            fallback = self._find_fallback_model(context)
            if fallback and fallback != context.model_requested:
                state.overridden_model = fallback
                state.add("model_access_control", "model_access_overridden", 0.10,
                          f"Role '{context.user_role}' cannot use '{context.model_requested}'; override to '{fallback}'")
            else:
                state.add("model_access_control", "model_access_denied", 1.0,
                          f"Role '{context.user_role}' cannot use '{context.model_requested}' and no fallback exists")
            return

        if context.department:
            blocked = cfg.DEPARTMENT_MODEL_BLOCKLIST.get(context.department.lower(), set())
            if context.model_requested in blocked:
                fallback = self._find_fallback_model(context)
                if fallback and fallback != context.model_requested:
                    state.overridden_model = fallback
                    state.add("model_access_control", "model_access_overridden", 0.10,
                              f"Dept '{context.department}' restriction; override to '{fallback}'")
                else:
                    state.add("model_access_control", "model_access_denied", 1.0,
                              f"Dept '{context.department}' blocked from '{context.model_requested}'")

    def _check_agent_permissions(self, context: PolicyContext, state: _State) -> None:
        if not context.agent_id or not context.agent_allowed_models:
            return
        effective_model = state.overridden_model or context.model_requested
        if effective_model not in context.agent_allowed_models:
            agent_fallback = next(
                (m for m in cfg.MODEL_FALLBACK_PRIORITY if m in context.agent_allowed_models),
                context.agent_allowed_models[0]
            )
            state.overridden_model = agent_fallback
            state.add("agent_permissions", "agent_model_override", 0.10,
                      f"Model '{effective_model}' not in agent allowlist; override to '{agent_fallback}'")

    def _check_data_classification(self, context: PolicyContext, state: _State) -> None:
        effective = context.data_classification
        text_lower = context.prompt.lower()

        if effective != "restricted":
            for kw in cfg.RESTRICTED_KEYWORDS:
                if kw in text_lower:
                    effective = "restricted"
                    state.add("data_classification", "sensitive_keywords_detected", 0.25,
                              f"Restricted keyword '{kw}' — classification elevated to 'restricted'")
                    break

        if effective not in ("restricted",):
            for kw in cfg.CONFIDENTIAL_KEYWORDS:
                if kw in text_lower:
                    effective = max(effective, "confidential",
                                    key=lambda x: {"public": 0, "internal": 1, "confidential": 2, "restricted": 3}.get(x, 0))
                    state.add("data_classification", "sensitive_keywords_detected", 0.15,
                              f"Confidential keyword '{kw}' detected")
                    break

        state.effective_classification = effective

        if context.provider in cfg.EXTERNAL_PROVIDERS:
            allowed = cfg.PROVIDER_DATA_POLICY.get(effective, set())
            if context.provider not in allowed:
                if effective == "restricted":
                    state.add("data_classification", "restricted_data_blocked", 1.0,
                              f"Provider '{context.provider}' cannot receive '{effective}' data")
                elif effective == "confidential":
                    state.add("data_classification", "confidential_data_external_provider", 0.60,
                              f"Confidential data to external provider '{context.provider}'")
                else:
                    source_policy = cfg.SOURCE_EXTERNAL_POLICY.get(context.source, "warn")
                    if source_policy != "allow":
                        state.add("data_classification", "external_provider_internal_data", 0.15,
                                  f"Provider '{context.provider}' is external; classification '{effective}'")

    def _check_pii(self, text: str, state: _State, context_label: str) -> None:
        working = text
        found_any = False
        for pattern, label, action in cfg.PII_RULES:
            if pattern.search(working):
                flag = f"{label}_detected"
                found_any = True
                if action == "redact":
                    working = pattern.sub(f"[REDACTED_{label.upper()}]", working)
                state.add("pii_detection", flag, cfg.PII_RISK_DELTA,
                          f"{label} pattern found in {context_label}")

        if found_any:
            if "pii_detected" not in state.flags:
                state.flags.append("pii_detected")
            if context_label == "request":
                state.prompt_redacted = working
            elif context_label == "response":
                state.response_redacted = working

    def _check_prompt_injection(self, context: PolicyContext, state: _State) -> None:
        text_lower = context.prompt.lower()
        injection_risk = 0.0
        for pattern in cfg.INJECTION_PATTERNS:
            if pattern.lower() in text_lower:
                injection_risk = min(1.0, injection_risk + cfg.INJECTION_RISK_DELTA_PER_MATCH)
                state.add("prompt_injection", "prompt_injection_suspected",
                          cfg.INJECTION_RISK_DELTA_PER_MATCH,
                          f"Injection pattern: '{pattern[:50]}'")
        if injection_risk >= cfg.INJECTION_ESCALATE_THRESHOLD:
            if "high_confidence_injection" not in state.flags:
                state.flags.append("high_confidence_injection")
                state.rule_trace.append({"rule": "prompt_injection",
                                          "flag": "high_confidence_injection",
                                          "risk_delta": 0.0,
                                          "note": f"Injection risk {injection_risk:.2f} ≥ threshold"})

    def _check_sensitive_keywords(self, text: str, state: _State) -> None:
        if "sensitive_keywords_detected" in state.flags:
            return
        text_lower = text.lower()
        for kw in cfg.RESTRICTED_KEYWORDS + cfg.CONFIDENTIAL_KEYWORDS:
            if kw in text_lower:
                state.add("sensitive_keywords", "sensitive_keywords_detected", 0.10,
                          f"Keyword '{kw}' detected")
                break

    def _check_research_outbound(self, context: PolicyContext, state: _State) -> None:
        if context.source != "research":
            return
        if state.effective_classification in cfg.RESEARCH_BLOCKED_CLASSIFICATIONS:
            if "restricted_data_blocked" not in state.flags:
                state.add("research_outbound", "restricted_data_blocked", 1.0,
                          f"Research queries with classification '{state.effective_classification}' "
                          "must not be sent to external web-search providers.")

    def _check_tool_grants(self, context: PolicyContext, state: _State) -> None:
        tools = context.tools_requested
        if not tools:
            return
        role_access = cfg.ROLE_TOOL_ACCESS.get(context.user_role)
        agent_grants: set[str] = set(context.agent_tool_grants or [])
        for tool in tools:
            tier = cfg.TOOL_RISK_TIERS.get(tool, "elevated")
            role_permits  = role_access is None or tool in role_access
            agent_permits = not context.agent_id or tool in agent_grants
            if not role_permits or not agent_permits:
                if tool not in state.tools_blocked:
                    state.tools_blocked.append(tool)
                source = "role policy" if not role_permits else "agent grants"
                state.add("tool_enforcement", "unauthorized_tool_requested",
                          cfg.TOOL_ENFORCEMENT_RISK_DELTA.get(tier, 0.35),
                          f"Tool '{tool}' (tier={tier}) denied by {source}")

    def _apply_risk_behavior_controls(self, state: _State) -> None:
        decision_preview, _ = state.resolve_decision()
        controls = cfg.RISK_BEHAVIOR_CONTROLS.get(decision_preview)
        if controls:
            state.system_prompt_injection = controls.get("system_prompt_injection")
            state.audit_level = controls.get("audit_level", "standard")
        elif decision_preview == "block":
            state.audit_level = "full"


# ── Singleton ──────────────────────────────────────────────────────────────────

policy_engine = PolicyEngine()


# ── Factory helper ─────────────────────────────────────────────────────────────

def build_policy_context(
    user,
    model: str,
    prompt: str,
    source: str,
    agent=None,
    ai_system=None,
    session_id: Optional[str] = None,
    data_classification: str = "internal",
    metadata: Optional[dict] = None,
    tools_requested: Optional[list] = None,
) -> PolicyContext:
    from config.model_registry import REGISTRY
    model_info = REGISTRY.get(model, {})
    provider = model_info.get("provider_type", "unknown")

    return PolicyContext(
        user_id=user.id,
        user_role=user.role,
        user_email=user.email,
        model_requested=model,
        provider=provider,
        prompt=prompt,
        source=source,
        department=getattr(user, "department", None),
        agent_id=getattr(agent, "id", None),
        agent_slug=getattr(agent, "slug", None),
        agent_type=getattr(agent, "agent_type", None),
        agent_allowed_models=getattr(agent, "allowed_models", None),
        agent_budget_limit=getattr(agent, "budget_limit_usd", None),
        agent_tool_grants=getattr(agent, "allowed_tools", None),
        tools_requested=tools_requested,
        data_classification=data_classification,
        session_id=session_id,
        metadata=metadata or {},
        registry_system_id=getattr(ai_system, "id", None),
        registry_system_name=getattr(ai_system, "name", None),
        registry_system_risk_level=getattr(ai_system, "risk_level", None),
        registry_system_department=getattr(ai_system, "department", None),
        registry_system_use_case=getattr(ai_system, "use_case", None),
    )


# ── Governance logging helper ──────────────────────────────────────────────────

async def log_policy_event(
    db: "AsyncSession",
    context: PolicyContext,
    decision: PolicyDecision,
    *,
    flush: bool = True,
) -> None:
    """Persist a GovernanceEvent for a non-trivial policy decision."""
    from models import GovernanceEvent

    if decision.decision == "allow" and not decision.flags:
        return

    severity_map = {
        "allow":    "info",
        "modify":   "info",
        "warn":     "warning",
        "escalate": "warning",
        "block":    "critical",
    }

    db.add(GovernanceEvent(
        id=str(uuid.uuid4()),
        timestamp=datetime.utcnow(),
        event_type="policy_decision",
        actor_id=context.user_id,
        actor_email=context.user_email,
        subject_id=context.registry_system_id or context.agent_id,
        subject_type="ai_system" if context.registry_system_id else "policy",
        payload={
            "decision":            decision.decision,
            "risk_score":          decision.risk_score,
            "flags":               decision.flags,
            "reason":              decision.reason,
            "model_requested":     context.model_requested,
            "overridden_model":    decision.overridden_model,
            "provider":            context.provider,
            "source":              context.source,
            "data_classification": context.data_classification,
            "tools_blocked":       decision.tools_blocked,
            "policy_version":      decision.policy_version,
            "audit_level":         decision.audit_level,
            "rule_trace":          decision.rule_trace[:20],
        },
        severity=severity_map.get(decision.decision, "info"),
    ))

    if flush:
        await db.flush()
