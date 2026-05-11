import asyncio
import logging

from config.model_costs import MODEL_INFO
from config.settings import settings

logger = logging.getLogger(__name__)

_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
_MODEL_ERROR = "[Model Error] Unable to process request. Please try again."
_TIMEOUT_SECONDS = 25


async def call_openrouter(
    model: str,
    messages: list[dict],
    system: str | None = None,
) -> tuple[str, int, int]:
    """Call OpenRouter using the OpenAI-compatible API."""
    try:
        from openai import AsyncOpenAI

        api_model = MODEL_INFO.get(model, {}).get("api_model", model)
        client = AsyncOpenAI(
            api_key=settings.openrouter_api_key,
            base_url=_OPENROUTER_BASE_URL,
            timeout=_TIMEOUT_SECONDS,
        )

        or_messages: list[dict] = []
        if system:
            or_messages.append({"role": "system", "content": system})
        or_messages.extend(messages)

        resp = await asyncio.wait_for(
            client.chat.completions.create(
                model=api_model,
                messages=or_messages,
                max_tokens=4096,
            ),
            timeout=_TIMEOUT_SECONDS,
        )
        text = (resp.choices[0].message.content or "").strip()
        if not text:
            return _MODEL_ERROR, 0, 0
        usage = resp.usage
        return text, (usage.prompt_tokens if usage else 0), (usage.completion_tokens if usage else 0)

    except asyncio.TimeoutError:
        logger.error("OpenRouter timeout after %ds for model %s", _TIMEOUT_SECONDS, model)
        return _MODEL_ERROR, 0, 0
    except Exception as exc:
        logger.error("OpenRouter API error for model %s: %s", model, exc)
        return _MODEL_ERROR, 0, 0
