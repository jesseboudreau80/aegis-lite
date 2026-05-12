---
name: Policy rule request
about: Request a new governance rule for the policy engine
title: "[policy] "
labels: ["policy", "enhancement"]
assignees: ""
---

## Rule description

<!-- What pattern should this rule detect or enforce? -->

## Threat or compliance driver

<!-- What attack, data exposure, or compliance requirement motivates this rule?
     Reference CVEs, OWASP items, regulatory frameworks (HIPAA, GDPR, SOC 2), or
     real-world incidents where applicable. -->

## Proposed detection logic

<!-- Regex pattern, keyword list, or detection approach: -->

```python
# Example:
re.compile(r"your_pattern_here")
```

## Suggested action

- [ ] `block` — hard stop, request rejected
- [ ] `redact` — content modified, request proceeds
- [ ] `warn` — flagged in governance log, request proceeds
- [ ] `escalate` — human review required

## Risk delta

<!-- How much should this add to the risk score (0.0–1.0)? -->
Suggested: `0.XX`

## False positive risk

<!-- Could this pattern match legitimate content? What's the expected false-positive rate? -->

## Test cases

```
# Should trigger:
"..."

# Should NOT trigger:
"..."
```

## References

<!-- Links to OWASP, CVEs, research papers, or prior art -->
