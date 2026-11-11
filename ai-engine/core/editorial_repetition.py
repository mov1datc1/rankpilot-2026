"""Locate repeated substantive sentences within one generated field, not across documents."""
import re
from collections import Counter


def repeated_sentences(text):
    sentences=[s.strip() for s in re.split(r'(?<=[.!?])\s+',str(text or '')) if len(s.split())>=12]
    normalized=lambda s:' '.join(s.split()).casefold()
    counts=Counter(normalized(s) for s in sentences)
    repeated=[s for s in sentences if counts[normalized(s)]>1]
    # A repeated substantive ending can survive a changed introductory subject.
    # Require a long EXACT passage, not semantic similarity or a short slogan.
    for i,left in enumerate(sentences):
        a=left.split()
        for right in sentences[i+1:]:
            b=right.split();common=0
            for x,y in zip(reversed(a),reversed(b)):
                if x.casefold()!=y.casefold():break
                common+=1
            if common>=20 and common>=0.75*min(len(a),len(b)):
                repeated.append(' '.join(a[-common:]))
    return list(dict.fromkeys(repeated))


def repetition_fields(proposal):
    fields={k:proposal.get(k,'') for k in ('b10','c2')}
    fields.update({f'candidates/{i}/submission_bio':c.get('submission_bio','') for i,c in enumerate(proposal.get('candidates',[]))})
    fields.update({f'matters/{i}/text':m.get('text','') for i,m in enumerate(proposal.get('matters',[]))})
    result={p:quotes for p,text in fields.items() if (quotes:=repeated_sentences(text))}
    opening=repeated_coverage_request(proposal.get('c2',''))
    if opening:result['c2']=list(dict.fromkeys(result.get('c2',[])+opening))
    return result


def repeated_coverage_request(text):
    """Locate adjacent requests sharing a long phrase, not arbitrary similarity.

    This only returns evidence for consolidation; it never deletes a sentence
    that may also contain a unique supporting fact.
    """
    sentences=re.split(r'(?<=[.!?])\s+',str(text or '').strip())[:2]
    if len(sentences)!=2:return []
    request=re.compile(r'\b(?:requests?|seeks?|warrants?|merits?|deserves?|should receive)\b',re.I)
    purpose=re.compile(r'\b(?:recognition|coverage|inclusion)\b',re.I)
    if not all(request.search(s) and purpose.search(s) for s in sentences):return []
    words=[re.findall(r'\w+',s.casefold()) for s in sentences]
    phrases=[{tuple(w[i:i+5]) for i in range(len(w)-4)} for w in words]
    return sentences if phrases[0] & phrases[1] else []
