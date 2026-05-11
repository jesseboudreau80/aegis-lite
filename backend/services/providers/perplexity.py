"""Perplexity Sonar provider adapter — uses the OpenAI-compatible API."""
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_MODEL_ERROR = "[Model Error] Unable to process request. Please try again."


async def call_perplexity(
    model: str,
    messages: list[dict],
    system: Optional[str] = None,
    search_domain_filter: Optional[list[str]] = None,
    search_recency_filter: Optional[str] = None,
) -> tuple[str, int, int, list[dict]]:
    """Returns (text, input_tokens, output_tokens, citations)."""
    try:
        from openai import AsyncOpenAI
        from config.model_costs import MODEL_INFO
        from config.settings import settings

        api_model = MODEL_INFO.get(model, {}).get("api_model", "sonar")
        client = AsyncOpenAI(
            api_key=settings.perplexity_api_key,
            base_url="https://api.perplexity.ai",
        )

        oai_messages: list[dict] = []
        if system:
            oai_messages.append({"role": "system", "content": system})
        oai_messages.extend(messages)

        extra: dict = {}
        if search_domain_filter:
            extra["search_domain_filter"] = search_domain_filter
        if search_recency_filter:
            extra["search_recency_filter"] = search_recency_filter

        resp = await client.chat.completions.create(
            model=api_model,
            messages=oai_messages,
            max_tokens=4096,
            temperature=0.2,
            **extra,
        )

        text = resp.choices[0].message.content or ""
        in_tokens = resp.usage.prompt_tokens if resp.usage else 0
        out_tokens = resp.usage.completion_tokens if resp.usage else 0
        citations = _extract_citations(resp)

        return text, in_tokens, out_tokens, citations

    except Exception as exc:
        logger.error("Perplexity API error for model %s: %s", model, exc)
        return _MODEL_ERROR, 0, 0, []


def _extract_citations(resp) -> list[dict]:
    citations: list[dict] = []
    raw = getattr(resp, "citations", None)
    if not raw:
        return citations
    for item in raw:
        if isinstance(item, str):
            citations.append({"url": item, "title": None, "snippet": None})
        elif isinstance(item, dict):
            citations.append({
                "url":     item.get("url"),
                "title":   item.get("title"),
                "snippet": item.get("snippet"),
            })
    return citations
