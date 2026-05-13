import asyncio
import logging

from config.model_costs import MODEL_INFO
from config.settings import settings

logger = logging.getLogger(__name__)

_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
_MODEL_ERROR = "[Model Error] Unable to process request. Please try again."
_TIMEOUT_SECONDS = 45


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

        logger.info("OpenRouter dispatch: model=%s api_model=%s", model, api_model)
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
            logger.warning("OpenRouter returned empty content for model %s (api_model=%s)", model, api_model)
            return "[Model returned no content. Try again or select a different model.]", 0, 0
        usage = resp.usage
        logger.info("OpenRouter success: model=%s tokens=%s/%s", model,
                    usage.prompt_tokens if usage else 0, usage.completion_tokens if usage else 0)
        return text, (usage.prompt_tokens if usage else 0), (usage.completion_tokens if usage else 0)

    except asyncio.TimeoutError:
        logger.error("OpenRouter timeout after %ds: model=%s", _TIMEOUT_SECONDS, model)
        return f"[Model timeout after {_TIMEOUT_SECONDS}s. The free tier model may be overloaded — try again.]", 0, 0
    except Exception as exc:
        logger.error("OpenRouter API error: model=%s error=%s", model, exc)
        # Surface meaningful error to user rather than generic message
        err_str = str(exc)
        if "404" in err_str or "No endpoints" in err_str:
            return "[Model unavailable on OpenRouter. The free tier endpoint may have changed — contact support.]", 0, 0
        if "401" in err_str or "403" in err_str:
            return "[OpenRouter authentication error. Check OPENROUTER_API_KEY in backend/.env.]", 0, 0
        if "429" in err_str:
            return "[Rate limit reached on this free model. Wait a moment or select a different model.]", 0, 0
        return _MODEL_ERROR, 0, 0
