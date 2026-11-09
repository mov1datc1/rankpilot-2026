"""Source-sized personal arguments shared by B9, Audit and their validators."""
import re
from pydantic import BaseModel, Field
from typing import Literal

PERSONAL_QUALITY_CONTRACT = 'complete-personal-case-v1'


class CategoryAssessment(BaseModel):
    decision: Literal['supported', 'pending', 'not_proposed']
    criterion: Literal['up_and_coming_growth', 'associate_distinction', 'established_individual', 'pending', 'not_proposed']
    career_stage_evidence: list[str] = Field(description='Exact original profile or personally attributed mandate passages supporting career stage. Missing ranking-search results are not career-stage evidence.')
    growth_evidence: list[str] = Field(description='For Up and Coming, exact own-source evidence of contribution to practice growth/developing reputation, not merely absence from a ranking table. Empty where that criterion is not established.')
    career_stage_assessment: str
    alternative_category: str = Field(description='One plausible alternative category or Category pending; never invent a verified current ranking.')
    alternative_comparison: str = Field(description='Why the proposed category is better supported than this alternative for this individual, addressing career maturity and actual evidence.')
    counterevidence: str = Field(description='Address contrary source facts, including established leadership, experience and professional offices, rather than applying one category uniformly.')


def required_personal_matters(package, strategy, candidate):
    """All core mandates personally led, plus substantive claimed own work.

    Team lists do not become personal leadership. Reservations remain eligible;
    an arbitrary two-link ceiling must not erase material attributed work.
    """
    from core.role_evidence import role_names_person_exactly, matter_names_person, team_listing_quote
    from core.editorial_execution import public_bio_included
    if not public_bio_included(package, candidate):
        return []
    register = {m['id']: m for m in package.get('matters', [])}
    eligible = {d['matter_id'] for d in strategy.get('matters', []) if d.get('disposition') in ('core', 'reserve')}
    required = []
    for decision in strategy.get('matters', []):
        matter = register.get(decision.get('matter_id'), {})
        if decision.get('disposition') == 'core' and any(
            role_names_person_exactly(candidate.get('name'), matter.get(k)) for k in ('leadPartner', 'lead_partner')):
            required.append(decision['matter_id'])
    for support in candidate.get('supporting_matters', []):
        mid = support.get('matter_id'); matter = register.get(mid, {})
        if mid in eligible and matter_names_person(candidate.get('name'), matter) and not team_listing_quote(
            candidate.get('name'), support.get('source_quote'), matter):
            required.append(mid)
    return list(dict.fromkeys(required))


def personal_quality_errors(package, strategy, proposal):
    if proposal.get('personal_quality_contract') != PERSONAL_QUALITY_CONTRACT:
        return []
    from core.role_evidence import identity
    from core.editorial_development import bind_quote
    roster = {identity(p.get('name') or p.get('fullName')): p for p in package.get('lawyers', [])}
    register = {m['id']: m for m in package.get('matters', [])}
    errors = []
    for index, candidate in enumerate(proposal.get('candidates', [])):
        prefix = f'Calidad personal candidates/{index}: '
        from core.biography_depth import biography_depth_errors
        errors.extend(prefix + error for error in biography_depth_errors(package, proposal, index))
        required = required_personal_matters(package, strategy, candidate)
        linked = {link.get('matter_id') for link in candidate.get('submission_case_coverage', [])}
        if set(required) - linked:
            errors.append(prefix + 'B9 omite trabajo material personalmente atribuido: ' + ', '.join(mid for mid in required if mid not in linked))
        if len(candidate.get('submission_bio', '').split()) > 1000:
            errors.append(prefix + 'B9 excede 1.000 palabras; condensar repeticiones conservando contribuciones y credenciales.')
        assessment = candidate.get('category_assessment')
        try:
            assessment = CategoryAssessment.model_validate(assessment).model_dump()
        except Exception:
            errors.append(prefix + 'Falta evaluación explícita del criterio y madurez de categoría.')
            continue
        person = roster.get(identity(candidate.get('name')), {})
        source_fields = ('bio', 'comments', 'standout_work', 'standoutWork', 'credentials', 'professional_roles', 'name', 'fullName', 'role')
        own_sources = [register[mid] for mid in required if mid in register]
        own_sources += [register[s['matter_id']] for s in candidate.get('supporting_matters', []) if s.get('matter_id') in register]
        for quote in assessment['career_stage_evidence'] + assessment['growth_evidence']:
            literal = ' '.join(quote.split())
            if not literal or not (any(literal in ' '.join(str(person.get(k) or '').split()) for k in source_fields)
                                   or any(bind_quote(quote, matter) for matter in own_sources)):
                errors.append(prefix + 'La categoría requiere evidencia propia literal, no otra persona ni una búsqueda sin coincidencia.')
        if not all(str(assessment.get(key) or '').strip() for key in ('career_stage_assessment','counterevidence','alternative_category','alternative_comparison')):
            errors.append(prefix + 'La categoría debe contrastar etapa profesional y evidencia contraria.')
        label = re.sub(r'[^a-z]', '', str(candidate.get('suggested_ranking', '')).casefold())
        nominated = candidate.get('recommendation') == 'present' and label != 'categorypending'
        if assessment['decision']=='pending' and (label!='categorypending' or not str(candidate.get('category_missing_criterion') or '').strip() or not str(candidate.get('recommended_action') or '').strip()):
            errors.append(prefix + 'La categoría pendiente requiere criterio pendiente y acción concreta coherentes.')
        if nominated and (assessment['decision'] != 'supported' or not assessment['career_stage_evidence']):
            errors.append(prefix + 'Una categoría propuesta necesita criterio sustentado o debe quedar pendiente con su acción.')
        if nominated and label == 'upandcoming' and (assessment['criterion'] != 'up_and_coming_growth' or not assessment['growth_evidence']):
            errors.append(prefix + 'Up and Coming requiere evidencia positiva del criterio de crecimiento/reputación, no falta de ranking.')
    return errors
