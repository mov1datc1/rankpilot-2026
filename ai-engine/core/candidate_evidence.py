"""Account for source profile facts separately from personally attributed mandates."""
import re
import unicodedata
from pydantic import BaseModel, Field
from typing import Literal

CONTRACT = 'candidate-profile-v1'
CHAMBERS_CATEGORY_GUIDANCE = {'source_url':'https://chambers.com/submissions/rankings-explained','guidance':'Choose an evidenced specific category as a proposed target, not a predicted or current recognition. Up-and-Coming concerns developing reputation and contribution to firm growth; a partner title does not by itself rule it out. Associates to Watch and Star Associate are associate categories, incompatible with confirmed partnership. Assess category maturity and criteria rather than forcing all partners into an unspecified band.'}
MATERIAL_ROLE=re.compile(r'\b(?:served|worked|appointed|director|counsel|president|chair(?:man|person)?|head of|partner|professor|degree|qualified|admitted|licen[cs]ed|presidente|socio|consejero|comisi[oó]n)\b',re.I)

def norm(value):
    return ' '.join(unicodedata.normalize('NFC',str(value or '')).split())


def bind_public_quote(quote, bio, person_name=''):
    """Anchor the same words after sentence joining; never repair a claim.

    Output evidence is distinct from immutable source evidence. A generated
    sentence can become a clause or start in lowercase without losing its
    words. Return only a unique actual span; changed or absent words still fail.
    """
    text=norm(bio);literal=norm(quote)
    if not literal or literal in text:return quote
    stem=literal.removesuffix('.')
    if len(stem.split())<4:return quote
    variants=[stem]
    # Resolve only this already-identified person's leading name prefix, never
    # another actor or a changed factual clause. The rest must match exactly.
    parts=norm(person_name).split()
    for count in range(1,len(parts)):
        prefix=' '.join(parts[:count])
        if re.match(r'^'+re.escape(prefix)+r'\s+',stem,re.I):
            variants.append(norm(person_name)+stem[len(prefix):])
    # Within this person's BIO only, bind the same predicate when the writer
    # substitutes the identified person's subject with He/She. No other actor,
    # predicate, negation, quantity or tense is replaced; uniqueness below is
    # mandatory and the final source review still checks personal attribution.
    for count in range(1,len(parts)+1):
        prefix=' '.join(parts[:count])
        if re.match(r'^'+re.escape(prefix)+r'\s+',stem,re.I):
            tail=stem[len(prefix):]
            variants.extend(pronoun+tail for pronoun in ('He','She'))
    subject=re.match(r'^(He|She)\s+',stem,re.I)
    if subject:
        tail=stem[subject.end()-1:]
        variants.extend(' '.join(parts[:count])+tail for count in range(1,len(parts)+1))
    # An additive "also" preserves the same assertion. Negation, tense,
    # qualifiers, roles, figures and every other word remain immutable.
    for variant in list(variants):
        if re.match(r'^(?:He|She)\s+(?!also\b)',variant,re.I):
            variants.append(re.sub(r'^(He|She)\s+',r'\1 also ',variant,flags=re.I))
    for variant in list(variants):
        if re.match(r'^(?:He|She)\s+(?:is|was|has|had)\s+(?!also\b)',variant,re.I):
            variants.append(re.sub(r'^(He|She)\s+(is|was|has|had)\s+',r'\1 \2 also ',variant,flags=re.I))
    # Quote glyphs have identical positions and meaning; return the actual
    # biography glyphs. Apostrophe placement, negation and all words stay exact.
    glyphs=str.maketrans({'‘':"'",'’':"'",'“':'"','”':'"'})
    view=text.translate(glyphs)
    matches={(m.start(),m.end()):text[m.start():m.end()] for variant in variants for m in re.finditer(
        r'(?<!\w)'+re.escape(variant.translate(glyphs))+r'(?!\w)',view,re.I)}
    return next(iter(matches.values())) if len(matches)==1 else quote

class ProfilePrivacyBasis(BaseModel):
    kind: Literal['profile_restriction', 'client_register']
    source_quote: str = Field(description='Exact original restriction, or exact registered client name. Never cite an editorial instruction or the generated reason.')
    matter_id: str = Field(description='Original matter ID for client_register; empty for a restriction in the original profile.')


class ProfileCoverage(BaseModel):
    reference: str = Field(description='Original profile unit ID. If it names multiple entities, repeat this reference in separate records, one exact atomic entity per record, retaining the complete original unit in source_quote.')
    relationship: Literal['former_employer','professional_association','client','qualification','other'] = 'other'
    entity_name: str = Field(default='', description='One exact atomic source entity, never a concatenated list. Use separate records with the same reference for several entities. Empty only when the unit has no named entity. A former employer is not a client mandate.')
    privacy_basis: ProfilePrivacyBasis | None = Field(default=None, description='Required only for generalize: bind the actual source restriction. A hypothetical lack of permission is not evidence. Null for retain/omit.')
    decision: Literal['retain','generalize','omit']
    source_quote: str = Field(description='Copy the complete original profile unit referenced here, without rewriting it.')
    public_quote: str = Field(description='Exact words in this same candidate submission_bio retaining its material credential. Empty only for a justified omission.')
    reason: str = Field(description='Internal reason: preserve material career, office and qualification evidence alongside mandates. Privacy may hide an identity, not erase the role. For generalize identify the actual original restriction; a former employer or professional association is not automatically a client and must retain its name unless specifically restricted. Omit only immaterial, duplicate or unsupported content, explaining which and why.')


def profile_units(person):
    result=[];seen=set()
    for field in ('bio','comments','standout_work','standoutWork','credentials','professional_roles'):
        value=person.get(field)
        if not isinstance(value,str):continue
        for part in re.split(r'(?<=[.!?])\s+|\n+|\||[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|https?://\S+',value):
            part=part.strip()
            if len(part.split())<3 or norm(part) in seen or norm(part)==norm(person.get('name') or person.get('fullName')):continue
            # Alternate source fields often repeat a span already in the bio.
            if field not in ('bio','comments') and any(norm(part) in norm(u['source_quote']) for u in result):continue
            seen.add(norm(part));result.append({'reference':f'P{len(result)+1:02d}','field':field,'source_quote':part})
    return result


def profile_privacy_error(person, item, package=None):
    """Require an original restriction, not the generator's free-text rationale.

    Literal binding is a necessary condition, not proof of semantic scope. The
    shared source-to-field reviewer still checks that the restriction applies.
    No names, roles or public wording are inserted by this check.
    """
    entity=norm(item.get('entity_name'))
    if entity and entity not in norm(item.get('source_quote')):
        return 'La identidad de la credencial no pertenece a su cita fuente.'
    if item.get('decision')!='generalize':
        if item.get('privacy_basis'):
            return 'Una credencial no generalizada no debe declarar una restricción aplicada.'
        if item.get('decision')=='retain' and entity and entity not in norm(item.get('public_quote')):
            return 'La credencial declara conservar una identidad ausente de su cita B9.'
        return None
    basis=item.get('privacy_basis') or {};quote=norm(basis.get('source_quote'))
    if not entity or not quote:
        return 'Generalización de credencial sin identidad y restricción fuente verificable; conservar el empleador o asociación salvo restricción real.'
    if basis.get('kind')=='profile_restriction':
        originals=[norm(person.get(f)) for f in ('bio','comments','credentials','professional_roles','confidentialityEvidence')]
        if not basis.get('matter_id') and any(quote in text for text in originals):
            return None
    elif basis.get('kind')=='client_register':
        if item.get('relationship')!='client':
            return 'La confidencialidad de un mandato no restringe por sí sola una relación profesional distinta; requiere restricción expresa del perfil.'
        matter=next((m for m in (package or {}).get('matters',[]) if m.get('id')==basis.get('matter_id')),None)
        if matter and entity==quote and entity in [norm(matter.get(k)) for k in ('client','name','title')] and (
            matter.get('publication_route')=='E' or matter.get('resolved_publication_status') in ('confidential','confirmation_required')):
            return None
    return 'La restricción de la credencial no está vinculada a su perfil original o a la misma entidad restringida del registro.'


def profile_errors(person, candidate, package=None):
    expected={u['reference']:u for u in profile_units(person)}
    actual=candidate.get('profile_coverage',[])
    refs=[c.get('reference') for c in actual]
    errors=[]
    identities=[(c.get('reference'),norm(c.get('entity_name'))) for c in actual]
    ambiguous={r for r in refs if refs.count(r)>1 and any(
        not norm(c.get('entity_name')) for c in actual if c.get('reference')==r)}
    if len(identities)!=len(set(identities)) or ambiguous or set(refs)!=set(expected):
        missing=[r for r in expected if r not in refs]
        unexpected=[r for r in refs if r not in expected]
        duplicate=sorted(ambiguous | {r for r,e in identities if identities.count((r,e))>1})
        errors.append('Falta rendición completa de credenciales del perfil fuente. '
            +f'Missing references: {missing}; unexpected: {unexpected}; duplicated: {duplicate}.')
    for item in actual:
        unit=expected.get(item.get('reference'))
        if not unit or norm(item.get('source_quote'))!=norm(unit['source_quote']):
            errors.append('Credencial sin cita íntegra de su propio perfil fuente.');continue
        if not norm(item.get('reason')):errors.append('Decisión de credencial sin razón interna.')
        privacy_error=profile_privacy_error(person,item,package)
        if privacy_error:errors.append(privacy_error)
        decision=item.get('decision');quote=norm(item.get('public_quote'))
        if decision in ('retain','generalize'):
            if not quote or quote not in norm(candidate.get('submission_bio')):
                errors.append('Credencial retenida ausente del B9 de esta persona. '
                    +f"profile_coverage/{item.get('reference')}/public_quote={item.get('public_quote')!r}; copy from the corrected BIO or restore the missing material credential.")
        elif decision=='omit':
            if MATERIAL_ROLE.search(unit['source_quote']):errors.append('Una credencial profesional material debe conservarse o generalizarse, no omitirse.')
            if quote:errors.append('Una omisión no puede declarar una cita pública retenida.')
        else:errors.append('Decisión de credencial inválida.')
    return errors


def category_error(candidate):
    label=norm(candidate.get('suggested_ranking')).casefold()
    generic=re.sub(r'[^a-záéíóúñ0-9 ]',' ',label)
    words=set(generic.split())
    placeholders={'band','tier','ranking','individual','lawyer','candidate','candidacy','potential','future','proposed','for','a','an','the','to','of','candidato','candidata','individual','banda','categoría','ranking','propuesta','a','de'}
    if words and words<=placeholders:
        return 'Falta una categoría razonada o una brecha explícita'
    if re.search(r'pending|pendiente|not established|not determined|por determinar',label):
        if label!='category pending' or not norm(candidate.get('category_missing_criterion')) or not norm(candidate.get('recommended_action')):
            return 'Categoría pendiente sin criterio concreto y acción'
    return None
