"""Account for source profile facts separately from personally attributed mandates."""
import re
import unicodedata
from pydantic import BaseModel, Field
from typing import Literal

CONTRACT = 'candidate-profile-v1'
# v1.0.102: the firm's own methodology (rag_knowledge "¿Cómo rankeamos
# abogado_as?", section E) proposes "Band ranking" for partners with proven
# leadership, relevant matters and reputation, e.g. "Band 5 candidate" /
# "possible lower-band candidate". The previous guidance named no category for
# an established partner, so the model wrote "Established Individual", which is
# not a Chambers category and was forced to Category pending (DeForest v1.0.101:
# all three nominated partners pending, category:fit failed 3/3).
CHAMBERS_CATEGORY_GUIDANCE = {'source_url':'https://chambers.com/submissions/rankings-explained','guidance':'Choose an evidenced specific category as a proposed target, not a predicted or current recognition. Categories: Band N candidate (a specific band) for partners with proven leadership of relevant mandates and established career standing; for a person not yet ranked, propose the lowest INDIVIDUAL band of the table and say in category_rationale that it is an editorial target, not a prediction or current recognition. table_categories, when supplied, lists the individual categories this exact ranking table uses (individual bands can differ from firm bands): choose only among them. When it is not supplied, do not name a band number: write Entry-band candidate. Up and Coming for developing reputation and contribution to firm growth; a partner title does not by itself rule it out. Associates to Watch and Star Associate are associate categories, incompatible with confirmed partnership. "Established Individual" and other maturity descriptors are not Chambers categories. Calibrate each person on their own career stage: compare a band target with Up and Coming for every nominated partner and record that comparison in category_assessment. A band fits established standing (head of practice, long senior career, senior professional offices, sustained leadership of major mandates); Up and Coming fits a partner whose market reputation is still developing and who is building the practice. Use Category pending only when neither a band nor Up and Coming can be argued from the evidence.'}
def table_categories(package):
    """Individual categories the cached ranking table for this guide, practice and
    jurisdiction actually uses (v1.0.109), or None when no table is cached.

    The guidance used "Band 5 candidate" as its example and every nominated
    partner received it, but Chambers Labour & Employment Mexico ranks
    individuals in Bands 1-4 only (Band 5 exists for firms). A category is
    proposed only among the table's own individual categories.
    """
    import json, os
    try:
        from utils.benchmark_cache import CACHE_DIR, _sanitize_key
        directory=str((package or {}).get('directory') or '');practice=str((package or {}).get('practice_area') or '')
        jurisdiction=str((package or {}).get('ranking_jurisdiction') or (package or {}).get('jurisdiction') or (package or {}).get('guide_region') or '').split('—')[-1].strip()
        if 'chambers' not in directory.casefold() or not practice or not jurisdiction:return None
        for name in dict.fromkeys((directory,directory.split('&')[0].strip(),'chambers')):
            path=os.path.join(CACHE_DIR,_sanitize_key(name,practice,jurisdiction)+'.json')
            if not os.path.exists(path):continue
            with open(path,encoding='utf-8') as handle:data=json.load(handle)
            found=(data.get('structure') or {}).get('individual_categories') or list(dict.fromkeys(
                i.get('band') for i in data.get('individuals',[]) if isinstance(i,dict) and i.get('band')))
            return [str(c) for c in found if c] or None
    except Exception:
        return None
    return None


def valid_band_label(label, categories):
    """The same proposal with a band the table really has: an individual band
    number the table does not use becomes the table's lowest individual band."""
    bands=sorted(int(m.group(1)) for c in categories or [] for m in [re.fullmatch(r'Band (\d)',str(c).strip())] if m)
    match=re.search(r'\bBand (\d)\b',str(label or ''))
    if not bands or not match or int(match.group(1)) in bands:return label
    return str(label).replace(match.group(0),f'Band {bands[-1]}')


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
        # v1.0.101: the profile spells the client its own way ("GeNi",
        # "Scheaffler", "SKF"). The shared identity table binds that spelling
        # to the registered confidential client; a profile-only client with no
        # register matter and no permission is bound to itself.
        # The cited register text itself stays literal: the profile spelling
        # or a literal part of the registered name, never a new variant.
        from core.client_identity import identity_basis, same_entity
        bound=identity_basis(item.get('entity_name'),package)
        registered=norm(bound['source_quote']) if bound else ''
        if bound and bound['matter_id']==str(basis.get('matter_id') or '') and (
                quote in (entity,registered) or (quote in registered and same_entity(quote,bound['source_quote']))):
            return None
    return 'La restricción de la credencial no está vinculada a su perfil original o a la misma entidad restringida del registro.'


def bind_profile_identities(candidate, package):
    """Bind each profile client to the shared identity table before validation.

    Only a client relationship is touched and only toward more privacy: a
    generalisation receives its canonical register basis. Retained names,
    employers, associations and every public word stay as the writer chose.
    """
    from core.client_identity import identity_basis
    for item in candidate.get('profile_coverage',[]):
        if item.get('relationship')!='client' or item.get('decision')!='generalize' or not norm(item.get('entity_name')):
            continue
        basis=item.get('privacy_basis') or {}
        if basis.get('kind')=='profile_restriction':
            continue
        bound=identity_basis(item.get('entity_name'),package)
        if bound:
            item['privacy_basis']=bound
    return candidate


def retained_confidential_clients(candidate, package):
    """Profile clients kept by name although they have no publication permission.

    A confidential register client, or (v1.0.102) a client named only in the
    profile: the Word renderer prints neither by name, so a retained name made
    the development text and the delivered Word disagree (DeForest v1.0.101:
    Megacable retained in Eduardo's B9, printed as "a confidential client").
    """
    from core.client_identity import register_matches, is_confidential, is_publishable, tokens
    found=[]
    bio=norm(candidate.get('submission_bio')).casefold()
    for item in candidate.get('profile_coverage',[]):
        if item.get('relationship')!='client' or item.get('decision')!='retain':continue
        name=norm(item.get('entity_name'))
        matches=register_matches(name,package)
        if matches and any(is_confidential(m) for m in matches) and not any(is_publishable(m) for m in matches):
            found.append(f"PRIVACY: {name} is a confidential registered client (matter "
                         f"{next(m['id'] for m in matches if is_confidential(m))}); use decision=generalize and describe it "
                         "without its name in submission_bio, keeping the legal work and role.")
        elif not matches and len(''.join(tokens(name)))>=3 and name.casefold() in bio:
            found.append(f"PRIVACY: {name} is named only in the profile and has no publishable register matter; "
                         "use decision=generalize (privacy_basis client_register, matter_id empty) and describe it without "
                         "its name in submission_bio, keeping the legal work and role.")
    return found


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


def firm_request_sources(package):
    """v1.0.118: the firm's own overview, coverage request and objectives.

    A category rationale may cite what the firm itself asks for a lawyer ("at
    least Band 2 for …"). The category reviewer did not receive that text and
    reported the request as unsupported (real run, two lawyers).
    """
    package=package or {}
    parts=[]
    for label,key in (('Department overview supplied by the firm','b10_source'),('Coverage request supplied by the firm','c2_source')):
        text=' '.join(str(package.get(key) or '').split())
        if text:parts.append(label+': '+text)
    objectives=package.get('objectives') or {}
    for label,key in (('Primary objective supplied by the firm','primary'),('Secondary objective supplied by the firm','secondary')):
        text=' '.join(str(objectives.get(key) or '').split()) if isinstance(objectives,dict) else ''
        if text:parts.append(label+': '+text)
    if not parts:return []
    return [{'source_label':'Firm overview, coverage request and objectives (original)','source_excerpt':'\n'.join(parts)}]


def individual_verification_sources(package, name):
    """v1.0.116: what the application itself verified in the directory about
    THIS lawyer, as a source record for the category review.

    The reviewer of category_rationale received the lawyer and their mandates
    only, so a category the application had verified in the official table was
    reported as "no verified official observation" (real run, three times).
    Only a verified observation with an observed category, and commentary of the
    lawyer's own retrieved profile, are included; never another person's.
    """
    from core.role_evidence import identity
    target=identity(name)
    verification=(package or {}).get('ranking_verification') or {}
    if not target or not isinstance(verification,dict):return []
    lines=[]
    for item in verification.get('individuals') or []:
        if not isinstance(item,dict) or identity(item.get('lawyer_name'))!=target:continue
        if not str(item.get('status') or '').startswith('verified') or not str(item.get('observed_band') or '').strip():continue
        evidence=item.get('evidence') or {}
        scope=', '.join(str(v) for v in (item.get('directory'),evidence.get('guide'),
            ('edition '+str(evidence['edition'])) if evidence.get('edition') else None,
            ' '.join(str(v) for v in (item.get('practice_area'),item.get('jurisdiction')) if v)) if v)
        lines.append(f"Official directory observation retrieved by the application ({scope}): {item.get('lawyer_name')} is ranked as {str(item['observed_band']).strip()}.")
    for profile in ((verification.get('profile_research') or {}).get('profiles') or []):
        subject=profile.get('subject') or {}
        if profile.get('status')!='retrieved' or subject.get('kind')!='individual' or identity(subject.get('name'))!=target:continue
        for comment in profile.get('commentary') or []:
            text=' '.join(str((comment or {}).get('text') or '').split())
            if text:lines.append('Official commentary on this lawyer\'s own directory profile: '+text)
    if not lines:return []
    return [{'source_label':'Official directory observation of this lawyer (ranking_verification)',
             'source_excerpt':'\n'.join(dict.fromkeys(lines))}]
