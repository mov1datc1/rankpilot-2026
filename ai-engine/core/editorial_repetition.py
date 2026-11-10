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
    return {p:quotes for p,text in fields.items() if (quotes:=repeated_sentences(text))}
