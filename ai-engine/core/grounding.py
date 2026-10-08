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


_UNITS = dict(zip('zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(), range(20)))
_TENS = dict(zip('twenty thirty forty fifty sixty seventy eighty ninety'.split(), range(20,100,10)))
_SCALES = {'thousand':1000, 'million':10**6, 'billion':10**9}
_WORD_NUMBER = re.compile(r'(?<![\w])(?:'+'|'.join([*_UNITS,*_TENS,'hundred',*_SCALES,'and'])+r')(?![\w])')


def _cardinal(words):
    """Strict English cardinal grammar; never add separate numbers or list items."""
    def small(group):
        if not group: return None
        base=0
        if len(group)>=2 and group[0] in _UNITS and 1<=_UNITS[group[0]]<=9 and group[1]=='hundred':
            base=_UNITS[group[0]]*100;group=group[2:]
            if not group: return base
            if group[0]=='and': group=group[1:]
            if not group: return None
        if len(group)==1 and group[0] in _UNITS: return base+_UNITS[group[0]]
        if group[0] in _TENS and (len(group)==1 or (len(group)==2 and group[1] in _UNITS and 1<=_UNITS[group[1]]<=9)):
            return base+_TENS[group[0]]+(_UNITS[group[1]] if len(group)==2 else 0)
        return None
    total,previous,start=0,10**12,0
    for i,word in enumerate(words):
        if word not in _SCALES: continue
        scale=_SCALES[word];value=small(words[start:i])
        if not value or scale>=previous: return None
        total+=value*scale;previous,start=scale,i+1
    tail=words[start:]
    if not tail: return total or None
    if total and tail[0]=='and': tail=tail[1:]
    value=small(tail)
    return total+value if value is not None else None


def written_numbers(text):
    text=normalized(text);groups=[]
    for token in _WORD_NUMBER.finditer(text):
        if groups and re.fullmatch(r'[\s\-‐‑–]+',text[groups[-1][-1].end():token.start()]): groups[-1].append(token)
        else: groups.append([token])
    values=set()
    for group in groups:
        words=[t.group() for t in group]
        while words and words[0]=='and': words.pop(0)
        while words and words[-1]=='and': words.pop()
        value=_cardinal(words) if words else None
        if value is not None: values.add(str(Decimal(value).normalize()))
    return values


def numbers(text, include_written=True):
    result=written_numbers(text) if include_written else set()
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


def currency_codes(text):
    value=str(text or '').upper()
    codes=set(re.findall(r'\b(?:USD|MXN|EUR|GBP|CAD|BRL|COP|CLP|ARS|CHF|JPY)\b',value))
    # Explicit currency designations only. A bare $ never establishes USD/MXN.
    aliases={'USD':r'(?<!\w)US\s*\$|\bU\.?S\.?\s+DOLLARS?\b|\bUNITED STATES DOLLARS?\b',
             'MXN':r'(?<!\w)MX\s*\$|\bMEXICAN PESOS?\b|\bPESOS? MEXICANOS?\b',
             'EUR':r'€|\bEUROS?\b', 'GBP':r'\bPOUNDS? STERLING\b|\bBRITISH POUNDS?\b'}
    codes.update(code for code,pattern in aliases.items() if re.search(pattern,value))
    return codes


def factual_issues(source, draft, entity_id=None):
    source, draft=str(source or ''),str(draft or '')
    issues=[]
    def add(code,message):
        issues.append({'code':code,'rule_id':'RP07','severity':'critical','scope':'submission','matter_id':entity_id,
            'entity_id':entity_id,'field_path':'optimizedText','owner':'rankpilot','action':'retry','retryable':True,
            'message':message,'source_evidence_ids':['source-'+hashlib.sha256(source.encode()).hexdigest()[:16]],
            'artifact_claim_ids':['claim-'+hashlib.sha256(draft.encode()).hexdigest()[:16]]})
    if numbers(draft, include_written=False)-numbers(source):
        add('UNSUPPORTED_NUMBER','La redacción añadió una cifra o fecha que no aparece en la fuente. RankPilot debe corregirla; conservamos el texto anterior.')
    if currency_codes(draft)-currency_codes(source):
        add('UNSUPPORTED_CURRENCY','La redacción añadió una moneda no acreditada por la fuente. RankPilot debe corregirla.')
    pending=r'\b(pending|pendiente|no decision|sin resoluci[oó]n|no judgment)\b'
    victory=r'\b(won|victory|victoria|awarded|recovered|gan[oó]|obtuvo sentencia favorable)\b'
    if re.search(pending,normalized(source)) and not re.search(victory,normalized(source)) and re.search(victory,normalized(draft)):
        add('PENDING_AS_VICTORY','La fuente describe un procedimiento pendiente y la redacción afirma un resultado favorable no acreditado. RankPilot debe corregir el resultado.')
    return issues


def grounding_result(source,text,entity_id=None):
    issues=factual_issues(source,text,entity_id)
    return {'success':False,'code':'GROUNDING_REJECTED','error':'La propuesta no pasó el control de hechos. Se conserva el texto anterior; no necesitas cambiar la fuente.','issues':issues} if issues else None
