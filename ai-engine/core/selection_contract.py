"""Model-facing selection: one required decision per immutable source reference."""
import re
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, create_model


class SelectionDecision(BaseModel):
    model_config = ConfigDict(extra='forbid')
    non_core_disposition: Literal['reserve', 'excluded'] = Field(description='Disposition only when this reference is NOT in core_references. Ignored for core references; core membership and Hero are selected exclusively by the ordered core_references list.')
    priority: int = Field(ge=1, description='Comparative editorial order, 1 strongest. Not a quality score.')
    legal_understanding: str = Field(description='Source-based asset/transaction, legal issue, work, outcome versus pending relief, and direct or mixed practice nexus. Never infer from sector or amount. State missing facts, not invented details.')
    rationale: str
    source_quote: str = Field(description='One contiguous verbatim excerpt from THIS reference only. Never combine matters or translate the quote.')


def selection_contract(matters):
    references = {f'M{i+1:02d}': matter['id'] for i, matter in enumerate(matters)}
    if not references or len(set(references.values())) != len(matters):
        raise ValueError('Selection requires a nonempty register of unique IDs')
    decisions = create_model('RegisteredDecisions', __config__=ConfigDict(extra='forbid'),
                             **{ref: (SelectionDecision, ...) for ref in references})
    schema = create_model('RegisteredStrategy', __config__=ConfigDict(extra='forbid'),
        decisions=(decisions, ...), core_references=(list[Literal[tuple(references)]], Field(max_length=min(20,len(references)), description='Ordered selected portfolio, strongest first; the first reference is the Hero. At most 20 registered references. Do not fill a quota. Use an empty list if no source-backed mandate is suitable. Each reference appears at most once. All other registered references use non_core_disposition.')),
        pending_questions=(list[str], ...), thesis=(str, ...))
    return schema, references


def project_selection(proposal, schema, references, matters=None):
    proposal = schema.model_validate(proposal).model_dump()
    # Membership/order is a single capacity-bounded model decision. Duplicate
    # references confer no extra slot or duplicate matter; every registered
    # decision is still projected exactly once. No numeric scores select cores.
    core=list(dict.fromkeys(proposal['core_references']))
    core_order={ref:index for index,ref in enumerate(core)}
    decisions = sorted(proposal['decisions'].items(), key=lambda pair: (0,core_order[pair[0]]) if pair[0] in core_order else (1,pair[1]['priority']))
    labels = {ref: next((str(m.get('client') or m.get('name') or m['id']) for m in (matters or []) if m['id'] == matter_id), matter_id) for ref, matter_id in references.items()}
    def display(text):
        return re.sub(r'(?<![\w-])M\d{2,}(?![\w-])', lambda match: labels.get(match.group(), match.group()), text) if matters else text
    return {'matters': [{'matter_id': references[ref], 'disposition':'core' if ref in core_order else decision['non_core_disposition'], **{key: display(value) if key == 'rationale' else value for key, value in decision.items() if key not in ('priority','non_core_disposition')}}
                        for ref, decision in decisions],
            'hero_matter_id': references.get(core[0]) if core else None,
            'pending_questions': [display(q) for q in proposal['pending_questions']], 'thesis': display(proposal['thesis'])}
