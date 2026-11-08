"""Reapply a known paid legacy repair; never generate a replacement proposal."""
import json
import re
from core.selection_review import repair_selection, _unknown_usage

LEGACY_QUOTE_ERROR='La reparación de redacción debe conservar su cita de fuente.'
LEGACY_REPAIR_REVISION='decreasing-selection-residual-progress-v33'

def cached_repair_identity(state):
    trace=state.get('trace') or []
    if (not state.get('selection_repair_replay_only') or (state.get('selection_repair_replay_errors') or state.get('errors'))!=[LEGACY_QUOTE_ERROR]
        or state.get('selection_repair_attempts')!=2 or state.get('selection_review_attempts')!=2
        or state.get('selection_diagnostic_invalid') is not False or _unknown_usage(trace)
        or state.get('selection_feedback',{}).get('field_only') is not False or not trace):
        raise ValueError('Paid selection repair replay is not eligible')
    last=trace[-1];rid=last.get('provider_request_id','');usage=last.get('usage') or {}
    if (last.get('role')!='strategist' or last.get('prompt_revision')!=LEGACY_REPAIR_REVISION
        or not re.fullmatch(r'resp_[a-z0-9]+',rid) or not isinstance(usage.get('total_tokens'),int)
        or usage['total_tokens']<=0):raise ValueError('Paid repair identity or known usage missing')
    return rid,usage['total_tokens']

def apply_paid_selection_repair(state,response):
    rid,tokens=cached_repair_identity(state)
    if (response.get('id')!=rid or response.get('status')!='completed' or response.get('incomplete_details')
        or response.get('usage',{}).get('total_tokens')!=tokens):
        raise ValueError('Existing paid repair response does not match its saved trace')
    text=''.join(c.get('text','') for item in response.get('output',[]) for c in item.get('content',[]) if c.get('type')=='output_text')
    proposal=json.loads(text)
    def cached_invoke(current,role,schema,instruction,payload):
        if role!='strategist':raise ValueError('Cached repair cannot invoke another role')
        return schema.model_validate(proposal).model_dump(),list(state['trace'])
    result=repair_selection(state,cached_invoke,count_attempt=False)
    if result is None or result.get('errors'):raise ValueError('Existing paid repair remains invalid')
    result.update(selection_repair_replay_only=False,selection_repair_replay_report={
        'existing_response_id':rid,'new_generation_calls':0,'paid_tokens_already_counted':tokens,
        'repair_attempts_preserved':state['selection_repair_attempts']})
    return result

def replay_selection_repair(state):
    # Retrieve only the response already named in this owned checkpoint.
    # Any retrieval/status/schema failure stops; there is no generation fallback.
    from openai import OpenAI
    from utils.model_factory import get_model_settings
    rid,_=cached_repair_identity(state)
    client=OpenAI(api_key=get_model_settings('repair')['openai_api_key'],max_retries=0,timeout=30)
    response=client.responses.retrieve(rid)
    return apply_paid_selection_repair(state,response.model_dump())
