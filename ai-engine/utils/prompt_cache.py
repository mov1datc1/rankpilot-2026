"""Prompt caching for GPT-5.6 under explicit control.

Measured on gpt-5.6-terra (17 Nov 2026, offline probe of 6 calls):
- the default (implicit) mode writes the WHOLE prompt to the cache on every
  call, billed at 1.25x input, and our prompts rarely repeat, so those writes
  are almost never read back;
- the structured-output schema is part of the cached prefix: a different
  schema reads nothing, the same schema with different user data reads the
  whole static developer block (6,730 of 6,743 tokens);
- explicit mode without a breakpoint writes nothing.

Plan per call:
- 'none': explicit mode, no breakpoint, no write charge (default);
- 'static': explicit mode with ONE breakpoint after the role's static block,
  used only when this role already ran with the identical schema in this case,
  so the write is likely to be read back (reads cost 0.1x input).
RANKPILOT_PROMPT_CACHE=implicit restores the provider default; off sends
nothing extra.
"""
import copy
import json
import os
from hashlib import sha256

VERSION = 'prompt-cache-v1'
BREAKPOINT = {'mode': 'explicit'}


def mode():
    value = os.environ.get('RANKPILOT_PROMPT_CACHE', 'explicit').strip().casefold()
    return value if value in ('explicit', 'implicit', 'off') else 'explicit'


def schema_digest(schema):
    return sha256(json.dumps(schema, sort_keys=True, separators=(',', ':'), default=str).encode()).hexdigest()[:16]


def plan(role, digest, trace):
    """'static' when this role already ran with the same schema in this case."""
    if mode() != 'explicit':
        return None
    repeated = any(isinstance(t, dict) and t.get('role') == role and t.get('schema_digest') == digest for t in trace or [])
    return 'static' if repeated else 'none'


def apply(payload, cache_plan):
    """Explicit mode and, for 'static', a breakpoint on the first system block."""
    if cache_plan not in ('none', 'static') or 'input' not in payload:
        return payload
    result = dict(payload)
    extra = dict(result.get('extra_body') or {})
    extra['prompt_cache_options'] = {'mode': 'explicit'}
    result['extra_body'] = extra
    if cache_plan == 'static':
        result['input'] = copy.deepcopy(result['input'])
        first = result['input'][0] if result['input'] else None
        if isinstance(first, dict) and isinstance(first.get('content'), list) and first['content']:
            block = first['content'][0]
            if isinstance(block, dict) and block.get('type') == 'input_text':
                block['prompt_cache_breakpoint'] = dict(BREAKPOINT)
    return result


def strip(payload):
    """The token-count endpoint receives the same input without cache markers."""
    result = dict(payload)
    if isinstance(result.get('input'), list):
        result['input'] = copy.deepcopy(result['input'])
        for message in result['input']:
            for block in (message.get('content') if isinstance(message, dict) and isinstance(message.get('content'), list) else []):
                if isinstance(block, dict):
                    block.pop('prompt_cache_breakpoint', None)
    return result
