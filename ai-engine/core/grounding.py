"""Local material-claim checks. Necessary safeguards, not semantic entailment proof.

These checks cannot certify prose; the exact-artifact reviewer still compares
meaning. They run before draft persistence and never turn model output into facts.
"""
import hashlib
import re
import unicodedata
from decimal import Decimal


def normalized(text):
    return ' '.join(unicodedata.normalize('NFKC', str(text or '')).casefold().split())


def numbers(text):
    result=set()
    for match in re.finditer(r'(?<![\w])\d+(?:[,.]\d+)*(?:\s*(?:billion|mill[oó]n(?:es)?|million|mil|thousand|bn|mn)\b)?', normalized(text)):
        raw=match.group()
        number=re.match(r'[\d,.]+',raw).group()
        # Thousands grouping versus decimal punctuation, including Spanish commas.
        if re.fullmatch(r'\d{1,3}(?:[,.]\d{3})+',number):
            number=number.replace(',','').replace('.','')
        elif ',' in number and '.' in number:
            separator=',' if number.rfind(',')>number.rfind('.') else '.'
            number=number.replace('.' if separator==',' else ',','').replace(',','.')
        else:
            number=number.replace(',','.')
        try:
            value=Decimal(number)
            if re.search(r'\b(billion|bn)\b',raw):value*=10**9
            elif re.search(r'\b(million|mill[oó]n(?:es)?|mn)\b',raw):value*=10**6
            elif re.search(r'\b(thousand|mil)\b',raw):value*=1000
            result.add(str(value.normalize()))
        except Exception: pass
    return result


def factual_issues(source, draft, entity_id=None):
    source, draft=str(source or ''),str(draft or '')
    issues=[]
    def add(code,message):
        issues.append({'code':code,'rule_id':'RP07','severity':'critical','scope':'submission','matter_id':entity_id,
            'entity_id':entity_id,'field_path':'optimizedText','owner':'rankpilot','action':'retry','retryable':True,
            'message':message,'source_evidence_ids':['source-'+hashlib.sha256(source.encode()).hexdigest()[:16]],
            'artifact_claim_ids':['claim-'+hashlib.sha256(draft.encode()).hexdigest()[:16]]})
    if numbers(draft)-numbers(source):
        add('UNSUPPORTED_NUMBER','La redacción añadió una cifra o fecha que no aparece en la fuente. RankPilot debe corregirla; conservamos el texto anterior.')
    currency=r'\b(?:USD|MXN|EUR|GBP|CAD|BRL|COP|CLP|ARS|CHF|JPY)\b'
    if set(re.findall(currency,draft.upper()))-set(re.findall(currency,source.upper())):
        add('UNSUPPORTED_CURRENCY','La redacción añadió una moneda no acreditada por la fuente. RankPilot debe corregirla.')
    pending=r'\b(pending|pendiente|no decision|sin resoluci[oó]n|no judgment)\b'
    victory=r'\b(won|victory|victoria|awarded|recovered|gan[oó]|obtuvo sentencia favorable)\b'
    if re.search(pending,normalized(source)) and not re.search(victory,normalized(source)) and re.search(victory,normalized(draft)):
        add('PENDING_AS_VICTORY','La fuente describe un procedimiento pendiente y la redacción afirma un resultado favorable no acreditado. RankPilot debe corregir el resultado.')
    return issues


def grounding_result(source,text,entity_id=None):
    issues=factual_issues(source,text,entity_id)
    return {'success':False,'code':'GROUNDING_REJECTED','error':'La propuesta no pasó el control de hechos. Se conserva el texto anterior; no necesitas cambiar la fuente.','issues':issues} if issues else None
