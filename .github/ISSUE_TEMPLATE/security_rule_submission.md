---
name: Security rule submission
about: Submit a new security-focused detection pattern for the policy engine
title: "[security] "
labels: ["security", "policy", "enhancement"]
assignees: ""
---

> **Note:** For vulnerabilities in Aegis Lite itself (authentication bypass, audit log tampering, etc.), please use the private disclosure process in [SECURITY.md](../../SECURITY.md) instead of a public issue.
>
> This template is for *new detection rules* — patterns that should be added to the policy engine to catch threats in user prompts or AI responses.

## Attack class

<!-- What category of attack or data exposure does this detect?
     Examples: prompt injection, credential exfiltration, PII leakage, jailbreak -->

## Detection pattern

```python
# Regex, string pattern, or detection logic:
```

## Evasion variants considered

<!-- What common evasion techniques (encoding, case variation, whitespace injection)
     should the rule handle? -->

## Severity classification

- [ ] Low — informational flag
- [ ] Medium — warn + enhanced audit
- [ ] High — escalate, human review
- [ ] Critical — hard block

## Tested against

- [ ] Real-world examples (please describe without including actual harmful content)
- [ ] Research / CTF context
- [ ] Red team exercise
- [ ] Academic paper (cite below)

## References

