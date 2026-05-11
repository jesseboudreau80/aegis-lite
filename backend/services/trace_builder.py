"""
Execution trace builder — constructs the ordered step log shown in the UI.
Each step has a stage name, message, status, and optional metadata.
"""
from __future__ import annotations


def build_execution_trace(
    policy_decision: dict | None,
    routing: dict,
    model: str,
    cost_info: dict,
    rate_limit_ok: bool,
    rate_msg: str = "",
) -> list[dict]:
    trace = []

    # Step 1 — rate limit check
    trace.append({
        "stage":   "rate_limit",
        "message": "Rate limit check" if rate_limit_ok else f"Rate limit: {rate_msg}",
        "status":  "complete" if rate_limit_ok else "warning",
    })

    # Step 2 — policy evaluation
    if policy_decision:
        decision = policy_decision.get("decision", "allow")
        status = {
            "allow":   "complete",
            "warn":    "warning",
            "modify":  "warning",
            "block":   "blocked",
            "escalate":"warning",
        }.get(decision, "complete")
        flags = policy_decision.get("flags", [])
        msg = f"Policy: {decision}"
        if flags:
            msg += f" ({', '.join(flags[:3])})"
        trace.append({
            "stage":    "policy",
            "message":  msg,
            "status":   status,
            "metadata": {
                "risk_score":    policy_decision.get("risk_score", 0.0),
                "flags":         flags,
                "policy_version": policy_decision.get("policy_version", ""),
            },
        })
    else:
        trace.append({"stage": "policy", "message": "Policy: allowed", "status": "complete"})

    # Step 3 — model routing
    fallback = routing.get("fallback_used", False)
    trace.append({
        "stage":    "routing",
        "message":  f"Model: {model}" + (" (fallback)" if fallback else ""),
        "status":   "warning" if fallback else "complete",
        "metadata": routing,
    })

    # Step 4 — response generated
    trace.append({
        "stage":    "response",
        "message":  f"Response generated — {cost_info.get('total_tokens', 0)} tokens, ${cost_info.get('cost_usd', 0):.6f}",
        "status":   "complete",
        "metadata": cost_info,
    })

    return trace
