"""Authorize qualification of generated claims, never resolution of source facts."""
import re
from typing import Literal
from pydantic import BaseModel, Field


class OutcomeQualification(BaseModel):
    disputed_alternatives: list[str] = Field(min_length=2, max_length=2,
        description='Two distinct, verbatim incompatible final-outcome passages from this SAME matter. Never use different matters or a general legal standard as if it were the client case outcome.')
    undisputed_result_quote: str = Field(description='A separate verbatim passage documenting uncontested interim relief or procedural work. Never one of the disputed final outcomes.')
    result_kind: Literal['interim_relief', 'procedural_step']
    preserves_material_work: bool = Field(description='True only if qualification preserves the evidenced legal contribution and decisive uncontested facts.')
    preserves_selection_basis: bool = Field(description='True only if the existing selection remains defensible WITHOUT relying on the disputed final victory. Otherwise request genuine source clarification.')


def grounded_outcome_qualification(defect, package):
    """A grounded repair permission remains a critical failure until re-reviewed."""
    if (defect.get('code')!='SOURCE_CONFLICT' or defect.get('conflict_basis')!='source_vs_source'
        or defect.get('conflict_resolution')!='qualify_disputed_outcome'
        or defect.get('field_path')!='outcome' or defect.get('scope') not in ('submission','letter')):
        return False
    assessment=defect.get('outcome_qualification') or {}
    if not assessment.get('preserves_material_work') or not assessment.get('preserves_selection_basis'):
        return False
    norm=lambda v:' '.join(str(v or '').split()).casefold()
    matter=next((m for m in (package or {}).get('matters',[]) if m.get('id')==defect.get('matter_id')),None)
    if not matter:return False
    sources=[norm(matter.get(k)) for k in ('source_excerpt','rawNotes','summary','completionDate','otherInfo')]
    alternatives=assessment.get('disputed_alternatives') or []
    if len(alternatives)!=2 or len({norm(q) for q in alternatives})!=2:
        return False
    result=norm(assessment.get('undisputed_result_quote'))
    if not result or any(not norm(q) or not any(norm(q) in s for s in sources) for q in alternatives):
        return False
    if not any(result in s for s in sources) or any(result in norm(q) or norm(q) in result for q in alternatives):
        return False
    # Require a distinct procedural achievement; a model cannot relabel a
    # disputed merits victory as an undisputed step by changing its enum.
    if re.search(r'\b(?:case was won|final (?:victory|judgment|judgement)|full legality|merits victory|victoria definitiva|sentencia definitiva|fondo)\b',result):
        return False
    kind=assessment.get('result_kind')
    if kind=='interim_relief':
        if not re.search(r'\b(?:suspensions?|injunctions?|interim|precautionary|suspensi[oó]n|suspensiones|cautelar(?:es)?)\b',result):return False
        if not re.search(r'\b(?:revoke[ds]?|revoked|lift(?:ed)?|grant(?:ed)?|obtain(?:ed)?|revoc\w*|levant\w*|conced\w*)\b',result):return False
    elif kind=='procedural_step':
        if not re.search(r'\b(?:filed|lodged|submitted|appealed|admitted|present\w*|interpus\w*|promovi\w*)\b',result):return False
    else:return False
    claim=norm(defect.get('artifact_quote'))
    rendered=norm((package or {}).get('rendered_artifact' if defect['scope']=='submission' else 'rendered_audit'))
    return bool(claim and claim in rendered)
