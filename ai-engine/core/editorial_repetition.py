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


# Connectives and generic framing that do not carry a fact of their own.
FRAMING={'also','further','additionally','likewise','includes','include','including','included','involving','involves',
         'involve','extends','extend','extending','practice','leadership','work','works','with','that','this','these',
         'those','such','their','them','from','into','across','where','which','while','both','been','have','other',
         'well','whose','within'}


def _content(sentence):
    words=re.findall(r'[^\W_]+',sentence.casefold())
    return {w for w in words if (len(w)>=4 or w.isdigit()) and w not in FRAMING}


def drop_restated_sentences(text, protected=()):
    """Remove the second of two ADJACENT sentences that only restate the first (v1.0.102).

    DeForest v1.0.101: "Eduardo's leadership also extends to work for X involving
    litigation coordination, cross-state governance and preventive frameworks.
    His practice also includes litigation coordination, cross-state governance
    and preventive frameworks, including work for X." Every content word of the
    removed sentence (numbers included) must already occur in its neighbour, so
    no fact is lost; an output quotation that depends on it keeps it.
    """
    text=str(text or '')
    norm=lambda s:' '.join(s.split()).casefold()
    quotes=[norm(q) for q in protected if norm(str(q or ''))]
    def keeps_quotes(candidate):
        whole=norm(candidate)
        return all(q in whole for q in quotes if q in norm(text))
    paragraphs=text.split('\n')
    changed=False
    for p,paragraph in enumerate(paragraphs):
        sentences=re.split(r'(?<=[.!?])\s+(?=\S)',paragraph.strip())
        before=len(sentences);i=1
        while i<len(sentences):
            a,b=_content(sentences[i-1]),_content(sentences[i])
            if len(a)>=5 and len(b)>=5 and (b<=a or a<=b):
                drops=[i,i-1] if b<=a else [i-1,i]
                for drop in drops:
                    trial=sentences[:drop]+sentences[drop+1:]
                    candidate='\n'.join(paragraphs[:p]+[' '.join(trial)]+paragraphs[p+1:])
                    if keeps_quotes(candidate):
                        sentences=trial;changed=True;break
                else:
                    i+=1
                continue
            i+=1
        if len(sentences)!=before:
            paragraphs[p]=' '.join(sentences)
    return '\n'.join(paragraphs) if changed else text


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
