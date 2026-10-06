"""Model-facing selection: one required decision per immutable source reference."""
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, create_model


class SelectionDecision(BaseModel):
    model_config = ConfigDict(extra='forbid')
    disposition: Literal['core', 'reserve', 'excluded']
    priority: int = Field(ge=1, description='Comparative editorial order, 1 strongest. Not a quality score.')
    rationale: str
    source_quote: str = Field(description='One contiguous verbatim excerpt from THIS reference only. Never combine matters or translate the quote.')


def selection_contract(matters):
    references = {f'M{i+1:02d}': matter['id'] for i, matter in enumerate(matters)}
    if not references or len(set(references.values())) != len(matters):
        raise ValueError('Selection requires a nonempty register of unique IDs')
    decisions = create_model('RegisteredDecisions', __config__=ConfigDict(extra='forbid'),
                             **{ref: (SelectionDecision, ...) for ref in references})
    schema = create_model('RegisteredStrategy', __config__=ConfigDict(extra='forbid'),
        decisions=(decisions, ...), hero_reference=(Optional[Literal[tuple(references)]], ...),
        pending_questions=(list[str], ...), thesis=(str, ...))
    return schema, references


def project_selection(proposal, schema, references):
    proposal = schema.model_validate(proposal).model_dump()
    decisions = sorted(proposal['decisions'].items(), key=lambda pair: pair[1]['priority'])
    return {'matters': [{'matter_id': references[ref], **{key: value for key, value in decision.items() if key != 'priority'}}
                        for ref, decision in decisions],
            'hero_matter_id': references.get(proposal['hero_reference']),
            'pending_questions': proposal['pending_questions'], 'thesis': proposal['thesis']}
