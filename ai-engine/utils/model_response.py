"""Normalize LangChain message content across Chat Completions and Responses API."""

import json
from collections.abc import Mapping
from typing import Any


def require_complete_response(message: Any) -> None:
    """A token-limited partial narrative must never replace a saved draft."""
    metadata = getattr(message, 'response_metadata', {}) or {}
    usage = getattr(message, 'usage_metadata', {}) or {}
    incomplete = metadata.get('incomplete_details')
    reason = incomplete.get('reason') if isinstance(incomplete, Mapping) else None
    out_tokens = int(usage.get('output_tokens') or 0) if isinstance(usage, Mapping) else 0
    if metadata.get('finish_reason') == 'length':
        raise ValueError('max_output_tokens: incomplete response')
    if metadata.get('status') == 'incomplete' or incomplete:
        if reason == 'max_output_tokens' or out_tokens > 0:
            raise ValueError(f'max_output_tokens: incomplete response (reason={reason}, output_tokens={out_tokens})')
        raise ValueError(f'incomplete provider response (0 output tokens, reason={reason})')


def coerce_message_text(content: Any) -> str:
    """Return only textual payloads from string or content-block responses.

    LangChain exposes Responses API content as a list of typed blocks while
    older call sites receive a plain string. Joining text blocks without a
    separator also supports JSON that the SDK split across multiple blocks.
    """

    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, bytes):
        return content.decode("utf-8", errors="replace")
    if isinstance(content, (list, tuple)):
        return "".join(coerce_message_text(item) for item in content)
    if hasattr(content, "content") and not isinstance(content, Mapping):
        return coerce_message_text(content.content)
    text_val = getattr(content, "text", None)
    if callable(text_val):
        try:
            res = text_val()
            if res:
                return coerce_message_text(res)
        except Exception:
            pass
    elif text_val is not None:
        return coerce_message_text(text_val)
    if isinstance(content, Mapping):
        # Filter out reasoning/thought blocks completely (e.g. OpenAI/OpenRouter reasoning tokens)
        block_type = str(content.get("type", "")).lower()
        if (
            block_type in {"reasoning", "thought", "reasoning_content", "thinking"}
            or "encrypted_content" in content
            or str(content.get("id", "")).startswith("rs_")
        ):
            return ""
        for key in ("text", "output_text"):
            if key in content:
                return coerce_message_text(content[key])
        if "content" in content and content.get("type") in {
            "text", "output_text", "message", "content_block"
        }:
            return coerce_message_text(content["content"])
        if "value" in content and len(content) <= 3:
            return coerce_message_text(content["value"])
        return json.dumps(content, ensure_ascii=False, default=str)
    return str(content)
