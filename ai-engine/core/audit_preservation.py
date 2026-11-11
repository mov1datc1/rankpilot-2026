"""Conservative loss guards for optional shortening, never factual rewriting.

These guards cover locatable semantic anchors, not general semantic equivalence.
If a shortened section loses an anchor, retain that original section and allow
the normal review to report its length. No extra generation is purchased here.
"""
import re

NUMBER = r'(?:\d[\d.,]*|one|two|three|four|five|six|seven|eight|nine|ten|un[oa]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)'
MEASURE = re.compile(r'\b'+NUMBER+r'\s+(?:entidades\s+federativas|federal\s+entities|estados|states|países|countries|'
    r'trabajadores|employees|workers|procedimientos|proceedings|empresas|companies|millones|million)\b',re.I)
AMOUNT = re.compile(r'\b(?:USD|MXN|EUR|GBP)\s*[\d.,]+(?:\s*(?:million|billion|millones))?|\b[\d.,]+\s*%',re.I)
STATUS = re.compile(r'\b(?:pendiente|pending|ongoing|sin\s+sentencia|no\s+confirmad[oa]|por\s+confirmar|'
    r'suspensi[oó]n\s+definitiva|amparo\s+concedido|favorable\s+ruling|no\s+verificad[oa])\b',re.I)

def anchors(text):
    # Preserve the whole sentence containing a result/qualification: keeping the
    # word "pending" alone could attach it to a different case or negate it.
    result=[m.group(0) for pattern in (MEASURE,AMOUNT) for m in pattern.finditer(text)]
    for sentence in re.split(r'(?<=[.!?;])\s+|\n',text):
        if STATUS.search(sentence):result.append(sentence.strip())
    return list(dict.fromkeys(x for x in result if x))

def preserve_sections(original, shortened):
    result=dict(shortened)
    for key,old in original.items():
        if not isinstance(old,str):continue
        new=shortened.get(key)
        if not isinstance(new,str) or not new.strip() or any(
            ' '.join(anchor.casefold().split()) not in ' '.join(new.casefold().split()) for anchor in anchors(old)):
            result[key]=old
    # Action ownership/destinations are already structured, not a shortening task.
    if 'next_actions' in original:result['next_actions']=original['next_actions']
    return result
