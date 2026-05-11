"""
Tool Gate — validates and audits tool invocations before execution.
Acts as a policy checkpoint for tool use in agent workflows.
"""
from __future__ import annotations

import logging
from typing import Optional

from config import policy_config as cfg

logger = logging.getLogger(__name__)


class ToolGate:
    """
    Validates tool access based on role and agent grants.
    Returns (permitted: bool, denied_tools: list[str], reason: str).
    """

    def check(
        self,
        tools_requested: list[str],
        user_role: str,
        agent_tool_grants: Optional[list[str]] = None,
    ) -> tuple[bool, list[str], str]:
        role_access = cfg.ROLE_TOOL_ACCESS.get(user_role)
        agent_grants = set(agent_tool_grants or [])
        denied: list[str] = []

        for tool in tools_requested:
            role_permits  = role_access is None or tool in role_access
            agent_permits = not agent_grants or tool in agent_grants
            if not role_permits or not agent_permits:
                denied.append(tool)

        if denied:
            return False, denied, f"Tools denied: {', '.join(denied)}"
        return True, [], "All tools permitted."


tool_gate = ToolGate()
