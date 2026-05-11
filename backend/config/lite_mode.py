"""
Aegis Lite edition configuration.

AEGIS_EDITION=lite is the default. This module provides feature flags that
gate enterprise-only features, allowing the same codebase to serve both
community (lite) and enterprise deployments when extended.
"""
from __future__ import annotations

from config.settings import settings

EDITION = settings.aegis_edition.lower()

# Feature flags — all True in lite edition
FEATURE_CHAT             = True
FEATURE_AGENTS           = True
FEATURE_RESEARCH         = True
FEATURE_GOVERNANCE       = True
FEATURE_AUDIT            = True
FEATURE_TRAINING         = True
FEATURE_USAGE_DASHBOARD  = True
FEATURE_AI_REGISTRY      = True
FEATURE_SUPPORT          = True
FEATURE_POLICY_ENGINE    = True

# Enterprise-only features — disabled in lite
FEATURE_COMPLIANCE       = EDITION != "lite"   # SOC 2 automation
FEATURE_INFRASTRUCTURE   = EDITION != "lite"   # Ecosystem registry
FEATURE_GOVERNED_ACTIONS = EDITION != "lite"   # Approval workflows
FEATURE_OPERATOR_MODE    = EDITION != "lite"   # Runtime control
FEATURE_WORKSPACE        = EDITION != "lite"   # Continuity engine
FEATURE_NOTIFICATIONS    = EDITION != "lite"   # Slack/webhook
