"""
Basic session memory — attaches brief context to the first message of a new conversation.
"""
from __future__ import annotations

_session_memory: dict[str, list[dict]] = {}


def set_context(user_id: str, messages: list[dict]) -> None:
    _session_memory[user_id] = messages


def get_context(user_id: str) -> list[dict]:
    return _session_memory.get(user_id, [])


def clear_context(user_id: str) -> None:
    _session_memory.pop(user_id, None)


def build_context_messages(user_id: str) -> list[dict]:
    """Return stored context or an empty list for new conversations."""
    return list(get_context(user_id))
