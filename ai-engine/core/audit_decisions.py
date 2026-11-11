"""Render individual decisions once; the Audit writer supplies analysis only."""
from pydantic import ConfigDict, Field, create_model

WRITING_TASK = '''Write a concise internal executive Audit in Spanish from the
CURRENT shared_decisions, development and original sources, in the schema fields.
Use approximately 1200–1800 words total, proportionate to evidence, without filler.
executive_assessment: filing recommendation, objective versus verified position,
main strength/limitation and comparative hero rationale. Where actual retrieved
peer commentary exists, contrast concrete capabilities with the source-backed
portfolio; table-only or absent research permits a scoped limitation, not invented
market calibration or ranking forecasts. Suggested budget 220 words.
portfolio: EXACTLY the complete ordered core, hero first, one concise source-backed
contribution per matter. Suggested budget 420 words; preserve numbers WITH their
concepts and qualifiers, actors, achieved results and actual pending stages.
leadership: supply ONE analytical paragraph for each keyed person. Explain their
distinct substantive contributions and career credentials consistently with their
CURRENT B9, safe public generalisation and personally attributed original work.
The application renders the nomination/category and precise pending criterion
from shared_decisions. Do not select, change or restate those decisions in the
paragraph. Do not turn team membership into personal results or infer seniority
from Lead partner form headings. Additional source leaders remain internal
assessments, not invented public roster profiles. Suggested combined budget 650
words INCLUDING the canonical headings/actions the application will insert.
evidence_gaps: concrete audit_required selected-versus-reserve comparisons and
actual exclusion reasons. Use neutral headings Asuntos en reserva / Asuntos
excluidos del portafolio. Distinguish practice relevance, represented client side,
selection value and genuine missing evidence. Never invent scale hierarchies or
ask for evidence already supplied. Suggested budget 230 words.
next_actions and next_steps: the SAME short genuine remaining actions with their
Studio destination. Explain what the answer would change. Include actual missing
period/filing data and optional evidence limitations, never tasks to fix generated
wording already corrected. Reference planning is user-supplied, not an endorsement;
do not reproduce private contact details or ask for answers already recorded.
Suggested budget 130 words. Missing optional information does not block delivery.
Use names, never internal IDs. Do not declare delivery approval, modify selection,
or introduce a strategy the Submission does not execute. Preserve documented
source uncertainty instead of inventing a result, category, title or permission.'''

def active(state):
    development=state.get('development') or {}
    return development.get('construction_contract')=='editorial-construction-v1' and bool(development.get('candidates'))


def letter_contract(state, base):
    if not active(state):return base
    candidates=state['development']['candidates']
    leadership=create_model('IndividualAuditArguments',__config__=ConfigDict(extra='forbid'),**{
        f'L{i+1:02d}':(str,Field(description='Source-grounded internal analysis for '+c['name']+
            '. Explain their distinctive own work, career credentials and evidence limits. '
            'Do not choose, restate or change their current/proposed category or nomination; '
            'the application inserts those from the shared decision. Do not duplicate its pending criterion/action.'))
        for i,c in enumerate(candidates)})
    return create_model('SharedDecisionAudit',__base__=base,leadership=(leadership,...))


def decision_heading(candidate):
    return (candidate['name']+' — Decisión: '+{'present':'proponer candidatura','develop':'desarrollar candidatura',
            'do_not_present':'no proponer candidatura'}.get(candidate.get('recommendation'),'por confirmar')+
            '. Situación actual: '+str(candidate.get('current_ranking') or 'sin verificación disponible')+
            '. Categoría propuesta: '+str(candidate.get('suggested_ranking') or 'Category pending')+'.')


def project_letter(state, letter):
    if not active(state) or not isinstance(letter.get('leadership'),dict):return letter
    paragraphs=[]
    for i,c in enumerate(state['development']['candidates']):
        argument=letter['leadership'][f'L{i+1:02d}'].strip()
        detail=decision_heading(c)+' '+argument
        if c.get('suggested_ranking')=='Category pending':
            detail+=' Criterio pendiente: '+c['category_missing_criterion']+' Acción: '+c['recommended_action']
        paragraphs.append(detail)
    return {**letter,'leadership':'\n\n'.join(paragraphs)}


def preserve_decisions(state, original, shortened):
    if not active(state):return shortened
    headings=[decision_heading(c) for c in state['development']['candidates']]
    old=str(original.get('leadership',''));new=str(shortened.get('leadership',''))
    if any(h in old and h not in new for h in headings):return {**shortened,'leadership':old}
    return shortened
