"""Normalize LangChain message content across Chat Completions and Responses API."""

import json
from collections.abc import Mapping
from typing import Any


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
