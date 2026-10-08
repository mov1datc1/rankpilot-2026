"""Single source of truth for OpenAI model configuration.

RankPilot uses Terra in production and varies reasoning depth by task.  Keeping
this here prevents extraction, editorial reasoning, and rewriting from silently
running with different API modes or token settings.
"""

import os
from typing import Dict, Literal

from langchain_openai import ChatOpenAI


ModelPurpose = Literal["extraction", "standard", "editorial", "judge", "rewrite", "letter", "development"]

DEFAULT_MODEL = "gpt-5.6-terra"
DEFAULT_REASONING: Dict[ModelPurpose, str] = {
    "extraction": "low",
    "standard": "medium",
    "editorial": "high",
    "judge": "medium",
    "rewrite": "low",
    "letter": "medium",
    "development": "high",
}

# Extraction needs room for the entire source register. Short rewriting and
# verdicts do not need the same allowance (reasoning also consumes this budget).
DEFAULT_OUTPUT_TOKENS = {
    "extraction": 32768, "standard": 8192, "editorial": 12288,
    "judge": 8192, "rewrite": 4096, "letter": 16384, "development": 24576,
}


def get_model_settings(purpose: ModelPurpose = "standard", model_override: str = "") -> Dict:
    """Return an auditable configuration without creating a network client."""

    if purpose == "judge":
        model_name = model_override or os.environ.get("OPENAI_JUDGE_MODEL", "gpt-5.6-sol")
    else:
        model_name = model_override or os.environ.get("OPENAI_MODEL", DEFAULT_MODEL)
    env_name = {
        "extraction": "REASONING_EFFORT_EXTRACTION",
        "standard": "REASONING_EFFORT",
        "editorial": "REASONING_EFFORT_EDITORIAL",
        "judge": "REASONING_EFFORT_JUDGE",
        "rewrite": "REASONING_EFFORT_REWRITE",
        "letter": "REASONING_EFFORT_LETTER",
        "development": "REASONING_EFFORT_DEVELOPMENT",
    }[purpose]
    reasoning = os.environ.get(env_name, DEFAULT_REASONING[purpose])
    allowed_reasoning = {"none", "low", "medium", "high", "xhigh", "max"}
    if reasoning not in allowed_reasoning:
        raise ValueError(
            f"Invalid {env_name}={reasoning!r}; expected one of {sorted(allowed_reasoning)}"
        )

    settings = {
        "model": model_name,
        "temperature": 0.0,
        "max_tokens": int(os.environ.get(f"OPENAI_MAX_OUTPUT_TOKENS_{purpose.upper()}", os.environ.get("OPENAI_MAX_OUTPUT_TOKENS", str(DEFAULT_OUTPUT_TOKENS[purpose])))),
        "request_timeout": int(os.environ.get("OPENAI_REQUEST_TIMEOUT", "210")),
        # Retry ownership belongs to the workflow. SDK retries multiply outer
        # retries and can pay for a timed-out generation more than once.
        "max_retries": 0,
        "openai_api_key": os.environ.get("OPENAI_API_KEY"),
    }
    if "gpt-5" in model_name:
        settings["reasoning_effort"] = reasoning
        # GPT-5.6 is designed for the Responses API; make the transport explicit
        # so different LangChain call sites cannot select it implicitly.
        settings["use_responses_api"] = True
    return settings


def get_model_profile(purpose: ModelPurpose = "standard") -> Dict[str, str]:
    """Safe profile for manifests/logging (never exposes the API key)."""

    settings = get_model_settings(purpose)
    return {
        "model": str(settings["model"]),
        "purpose": purpose,
        "reasoning_effort": str(settings.get("reasoning_effort", "n/a")),
        "api_mode": "responses" if settings.get("use_responses_api") else "chat_completions",
        "max_output_tokens": str(settings["max_tokens"]),
    }


def create_chat_model(
    purpose: ModelPurpose = "standard", model_override: str = ""
) -> ChatOpenAI:
    return ChatOpenAI(**get_model_settings(purpose, model_override=model_override))
