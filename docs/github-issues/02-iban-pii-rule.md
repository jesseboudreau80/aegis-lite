# Issue: Add IBAN detection to PII rule set

**Labels:** `good-first-issue` · `policy` · `backend` · `security`

## Description

International Bank Account Numbers (IBANs) are not currently detected by the PII engine. IBANs are directly useful for financial fraud and should be redacted from any prompt before it reaches an AI provider.

## Why this matters

IBANs are commonly found in financial documents, expense reports, and HR records — exactly the kind of content users might paste into an AI workspace. An IBAN in a prompt that reaches an external provider (OpenRouter, Perplexity) creates a data governance risk.

## Acceptance criteria

- [ ] IBAN regex added to `PII_RULES` in `backend/config/policy_config.py`
- [ ] Action is `"redact"` (not warn — IBANs are sensitive financial identifiers)
- [ ] Flag label is `"iban"`
- [ ] Pattern matches: `GB82 WEST 1234 5698 7654 32` (with spaces), `DE89370400440532013000` (no spaces), `FR7630006000011234567890189` (alphanumeric variants)
- [ ] Pattern does NOT match: regular long numbers, phone numbers, UUIDs
- [ ] Unit test added in `backend/tests/test_policy_engine.py`

## Implementation

Edit `backend/config/policy_config.py`:

```python
# In PII_RULES, add:
(
    re.compile(
        r'\b[A-Z]{2}\d{2}[\s]?(?:[A-Z0-9]{4}[\s]?){3,7}[A-Z0-9]{1,4}\b',
        re.IGNORECASE,
    ),
    "iban",
    "redact",
),
```

Verify the pattern against test vectors at [IBAN checker](https://www.ibantest.com/).

## Test cases

```python
# Should trigger (redact):
"please send payment to GB82 WEST 1234 5698 7654 32"
"wire transfer: DE89370400440532013000"

# Should NOT trigger:
"the order number is 1234 5678 9012 3456"  # regular number
"call 555-867-5309"                         # phone
```

## Suggested files to modify

- `backend/config/policy_config.py` — add the rule to `PII_RULES`
- `backend/tests/test_policy_engine.py` — add IBAN test cases

## Good-first-issue guidance

This is a single-file Python change plus test. The `PII_RULES` list in `policy_config.py` already has 4 entries — follow the same pattern. All regex is compiled at import time, so just add a tuple `(compiled_pattern, label, action)` to the list.
