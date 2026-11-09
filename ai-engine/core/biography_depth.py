"""Editorial depth is a sourced argument, not a word-count certificate."""
from typing import Literal
from pydantic import BaseModel, Field

DEPTH_CONTRACT = 'sourced-biography-depth-v1'
DEPTH_POLICY = """B9 EDITORIAL DEPTH: For each proposed individual whose BIO is included, the target is 500–1,000 words PER PERSON. The personal argument must develop available career credentials and personally attributed mandates: legal difficulty, the person's actual role and action, achieved outcomes or accurately pending work, and the distinct contribution to the practice. Related work belongs in natural prose, not a catalogue. General legal doctrine, promotional adjectives, repeated roles and invented actions are not depth. The short executive Audit budget does not apply to B9. Material contributions and credentials take priority over brevity. Non-nominated team members retain proportionate factual profiles, not fabricated nomination arguments. A shorter proposed BIO is acceptable only when the original profile AND all pertinent personally attributed core/reserve evidence genuinely cannot support greater depth without invention or repetition. That limitation needs a concrete explanation and precise optional information that would improve it; neither public filler nor reconfirmation of facts already supplied. A short output is not evidence of a short source. Confidentiality calls for safe public generalization, not loss of legal substance. Nomination must never be withdrawn or downgraded merely to evade the depth target. A 500-word catalogue or repeated generic narrative is still inadequate. Firm voice requires varied natural sentences and distinct legal contributions, not repeated 'As named lead' or a report of what the source lists. Confirmed practice leadership belongs once, without duplicate introductory sentences."""
DEPTH_INSTRUCTION = DEPTH_POLICY + " Return biography_depth with decision developed, source_limited or not_nominated, following this policy. For source_limited record source_limitation and information_to_add internally; otherwise leave both empty. The independent reviewer will verify any exception against original evidence."



class BiographyDepth(BaseModel):
    decision: Literal['developed', 'source_limited', 'not_nominated']
    source_limitation: str = Field(description='Internal concrete reason the ORIGINAL evidence cannot sustain 500 words without padding, only for source_limited. Empty otherwise. Consider career credentials and all personally attributed core/reserve work; do not cite confidentiality as a reason to erase legal substance.')
    information_to_add: str = Field(description='For source_limited only: precise genuinely missing personal role/action/result or career evidence the user could add. Not a blocker for the accurate limited BIO. Never request already supplied facts. Empty otherwise.')


def biography_depth_errors(package, proposal, index):
    if proposal.get('biography_depth_contract') != DEPTH_CONTRACT:
        return []
    from core.editorial_execution import public_bio_included
    candidate = proposal['candidates'][index]
    try:
        depth = BiographyDepth.model_validate(candidate.get('biography_depth')).model_dump()
    except Exception:
        return ['B9 requiere evaluación de profundidad y de una eventual limitación real de fuente.']
    nominated = candidate.get('recommendation') == 'present' and public_bio_included(package, candidate)
    words = len(str(candidate.get('submission_bio') or '').split())
    if not nominated:
        return [] if depth['decision'] == 'not_nominated' else ['B9 de participación debe distinguirse de una candidatura propuesta.']
    if depth['decision'] == 'not_nominated':
        return ['Una candidatura propuesta no puede eludir el desarrollo B9 declarándose no nominada.']
    if words > 1000:
        return ['B9 excede 1.000 palabras; conservar evidencia y condensar repeticiones.']
    if words >= 500:
        return [] if depth['decision'] == 'developed' and not depth['source_limitation'].strip() and not depth['information_to_add'].strip() else ['B9 desarrollado debe retirar una excepción de profundidad ya superada.']
    if depth['decision'] != 'source_limited':
        return ['B9 por debajo del rango objetivo 500–1.000: desarrollar la evidencia propia disponible, sin relleno.']
    if not depth['source_limitation'].strip() or not depth['information_to_add'].strip():
        return ['B9 limitado requiere la carencia concreta de la fuente y qué información adicional ayudaría; la revisión independiente comprobará ambas.']
    return []
