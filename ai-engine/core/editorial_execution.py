"""Literal execution links connect the shared case to the public arguments.

These checks bind evidence and output, not the reviewer's semantic judgment.
Legacy proposals are unchanged; newly generated proposals opt into the contract.
"""
from pydantic import BaseModel, Field
import re

EXECUTION_CONTRACT='linked-editorial-execution-v1'

class PersonalCaseLink(BaseModel):
    matter_id: str
    source_quote: str = Field(description='Exact original passage from this personally attributed supporting mandate. Never borrow another person work.')
    public_quote: str = Field(description='Exact passage in this candidate B9 developing the personal legal contribution, issue and documented result or actual pending position. Anonymize restricted identity and metrics; a generic service list is insufficient.')

class InstitutionalLink(BaseModel):
    argument_index: int
    b10_quote: str = Field(description='Exact B10 passage demonstrating this case_plan argument through work, contribution and supported result.')
    c2_quote: str = Field(description='Exact C2 passage explaining why this evidence warrants the requested coverage. Complement B10 rather than repeat its service list.')

def norm(value):
    return ' '.join(str(value or '').split())

def public_bio_included(package,candidate):
    """Match directory output scope without changing nomination eligibility."""
    return '500' not in str(package.get('directory') or '').casefold() or (
        candidate.get('recommendation')=='present'
        and str(candidate.get('suggested_ranking') or '').casefold()!='category pending')

def primary_lead_anchor(package,strategy,candidate):
    """Use canonical priority among this person's source-confirmed lead mandates."""
    from core.role_evidence import role_names_person_exactly
    register={m['id']:m for m in package.get('matters',[])}
    if not public_bio_included(package,candidate):return None
    for decision in (strategy or {}).get('matters',[]):
        matter=register.get(decision.get('matter_id'),{})
        if decision.get('disposition')=='core' and any(role_names_person_exactly(candidate.get('name'),matter.get(k)) for k in ('leadPartner','lead_partner')):
            return decision['matter_id']
    return None

def personal_argument_requirement(package,candidate):
    """Share the source-capacity threshold with the exact-document reviewer."""
    sources={m['id']:m for m in package.get('matters',[])}
    support={m['matter_id'] for m in candidate.get('supporting_matters',[])}
    from core.role_evidence import team_listing_quote
    # Directory inclusion does not turn a team list into individual legal work.
    # A proposed nomination still needs its full personal argument; a limited,
    # category-pending profile can state only participation actually supplied.
    # A descriptive label (including "Not proposed") is not a nomination.
    # Inclusion in Chambers B9 still preserves sourced participation and any
    # substantive work, but must not turn a team listing into personal results.
    nominated=candidate.get('recommendation')=='present'
    substantive={item.get('matter_id') for item in candidate.get('supporting_matters',[])
        if not team_listing_quote(candidate.get('name'),item.get('source_quote'),sources.get(item.get('matter_id'),{}))}
    return min(2,len(support if nominated else substantive)) if public_bio_included(package,candidate) else 0

def personal_case_errors(package,candidate,strategy=None):
    from core.editorial_development import bind_quote
    from core.role_evidence import matter_names_person
    sources={m['id']:m for m in package.get('matters',[])}
    support={m['matter_id'] for m in candidate.get('supporting_matters',[])}
    links=candidate.get('submission_case_coverage',[])
    required=personal_argument_requirement(package,candidate)
    errors=[];ids=[];quotes=[]
    for link in links:
        mid=link.get('matter_id');matter=sources.get(mid,{})
        q=norm(link.get('public_quote'))
        if mid not in support or not matter_names_person(candidate.get('name'),matter) or not bind_quote(link.get('source_quote'),matter):
            errors.append('El argumento B9 requiere fuente propia y atribución personal del asunto.')
        if not q or q not in norm(candidate.get('submission_bio')):
            errors.append('La contribución personal debe ejecutarse literalmente en el B9 de esta persona.')
        ids.append(mid);quotes.append(q)
    if len(set(ids))<required or len(ids)!=len(set(ids)) or len(quotes)!=len(set(quotes)):
        errors.append('El B9 propuesto requiere contribuciones distintas de sus asuntos atribuidos, no una biografía genérica.')
    anchor=primary_lead_anchor(package,strategy,candidate)
    if anchor and anchor not in ids:
        errors.append('B9 debe ejecutar el mandato principal personalmente liderado según la prioridad canónica, no sustituirlo por asuntos secundarios.')
    return errors

def institutional_errors(proposal):
    expected=set(range(len(proposal.get('case_plan',{}).get('institutional_arguments',[]))))
    links=proposal.get('institutional_execution',[]);ids=[link.get('argument_index') for link in links]
    errors=[]
    if norm(proposal.get('b10')) and norm(proposal.get('b10'))==norm(proposal.get('c2')):
        errors.append('C2 debe argumentar la cobertura solicitada, no duplicar B10.')
    if set(ids)!=expected or len(ids)!=len(set(ids)):
        errors.append('B10 y C2 deben ejecutar cada argumento de la propuesta compartida.')
    for link in links:
        b,c=norm(link.get('b10_quote')),norm(link.get('c2_quote'))
        if not b or b not in norm(proposal.get('b10')) or not c or c not in norm(proposal.get('c2')):
            errors.append('La prueba de ejecución institucional debe citar su propio campo B10/C2.')
        elif b==c:
            errors.append('C2 debe argumentar la cobertura solicitada, no copiar el párrafo de B10.')
    return errors

def execution_errors(package,proposal,strategy=None):
    if proposal.get('execution_contract')!=EXECUTION_CONTRACT:return []
    errors=institutional_errors(proposal)
    for c in proposal.get('candidates',[]):
        errors.extend('Caso personal B9: '+str(c.get('name'))+': '+e for e in personal_case_errors(package,c,strategy))
    from core.contextual_financial_evidence import missing_contextual_amounts
    register={m['id']:m for m in package.get('matters',[])}
    for draft in proposal.get('matters',[]):
        if missing_contextual_amounts(register.get(draft.get('matter_id'),{}),draft.get('text','')):
            errors.append('Contexto financiero original omitido en E2: '+str(draft.get('matter_id')))
    errors.extend('Función departamental B9 ausente: '+proposal['candidates'][i]['name'] for i in missing_head_bios(package,proposal))
    return errors

def missing_head_bios(package,proposal):
    if proposal.get('execution_contract')!=EXECUTION_CONTRACT:return []
    from core.role_evidence import identity
    heads={identity(h.get('name')) for h in package.get('filing_details',{}).get('heads',[]) if isinstance(h,dict)}
    # Detect absence before paying for the whole Word review. This does not
    # certify the title: the independent reviewer still checks meaning/source.
    function=re.compile(r'\b(?:head(?:s)?\s+(?:of\s+)?|leads?\s+|leading\s+|responsible\s+for\s+)(?:[\w’&-]+\s+){0,8}(?:department|practice)\b|\bdepartment(?:al)?\s+(?:head|leader)\b',re.I)
    return [i for i,c in enumerate(proposal.get('candidates',[]))
        if identity(c.get('name')) in heads and not ('500' in str(package.get('directory','')) and c.get('recommendation')!='present')
        and not function.search(str(c.get('submission_bio','')))]
