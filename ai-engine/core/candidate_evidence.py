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

class ProfileCoverage(BaseModel):
    reference: str
    decision: Literal['retain','generalize','omit']
    source_quote: str = Field(description='Copy the complete original profile unit referenced here, without rewriting it.')
    public_quote: str = Field(description='Exact words in this same candidate submission_bio retaining its material credential. Empty only for a justified omission.')
    reason: str = Field(description='Internal reason: preserve material career, office and qualification evidence alongside mandates. Privacy may hide an identity, not erase the role. Omit only immaterial, duplicate or unsupported content, explaining which and why.')


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


def profile_errors(person, candidate):
    expected={u['reference']:u for u in profile_units(person)}
    actual=candidate.get('profile_coverage',[])
    refs=[c.get('reference') for c in actual]
    errors=[]
    if len(refs)!=len(set(refs)) or set(refs)!=set(expected):
        errors.append('Falta rendición completa de credenciales del perfil fuente.')
    for item in actual:
        unit=expected.get(item.get('reference'))
        if not unit or norm(item.get('source_quote'))!=norm(unit['source_quote']):
            errors.append('Credencial sin cita íntegra de su propio perfil fuente.');continue
        if not norm(item.get('reason')):errors.append('Decisión de credencial sin razón interna.')
        decision=item.get('decision');quote=norm(item.get('public_quote'))
        if decision in ('retain','generalize'):
            if not quote or quote not in norm(candidate.get('submission_bio')):
                errors.append('Credencial retenida ausente del B9 de esta persona.')
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
