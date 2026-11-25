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
        touched=len(sentences)!=before
        # v1.0.116 (real run): a repair that may only ADD text introduced its new
        # sentence by repeating the opening of the next one ("X is one of the lead
        # partners on Y. The department prepared Z. X is one of the lead partners
        # on Y, where …"). The short sentence is word for word the opening of the
        # longer one, so removing it loses nothing; the longer one takes its place
        # so the paragraph still introduces the mandate before the addition.
        # A piece that continues in lower case ("… S.A. in Venezuela") is part of
        # the same sentence and is never separated from it.
        whole=[]
        for piece in sentences:
            if whole and piece[:1].islower():whole[-1]+=' '+piece
            else:whole.append(piece)
        strip=lambda s:norm(s).rstrip('.!?;:, ')
        i=0
        while i<len(whole):
            short=strip(whole[i])
            owner=next((j for j,other in enumerate(whole) if j!=i and len(short.split())>=8
                        and norm(other).startswith(short) and len(norm(other))>len(short)+1
                        and not norm(other)[len(short)].isalnum()),None)
            if owner is not None:
                trial=list(whole)
                if owner>i:trial[i]=trial[owner];del trial[owner]
                else:del trial[i]
                candidate='\n'.join(paragraphs[:p]+[' '.join(trial)]+paragraphs[p+1:])
                if keeps_quotes(candidate):
                    whole=trial;changed=touched=True;continue
            i+=1
        if touched:
            paragraphs[p]=' '.join(whole)
    return '\n'.join(paragraphs) if changed else text


def drop_restated_with_bindings(text, quotes=()):
    """drop_restated_sentences, also when an output quotation contains the repetition.

    v1.0.116 (real run): the quotation bound to a repaired B9 was the whole
    paragraph, repeated sentence included, so protecting it kept the repetition.
    The same removal is applied to that quotation; the change is made only if
    every quotation is still a literal passage of the result. Returns the text
    and {old quotation: new quotation} for the bindings that moved with it.
    """
    literal=lambda s:' '.join(str(s or '').split())
    text=drop_restated_sentences(text,quotes)
    free=drop_restated_sentences(text,())
    if free==text:return text,{}
    moved={}
    for quote in quotes:
        if not literal(quote) or literal(quote) not in literal(text) or literal(quote) in literal(free):continue
        fixed=drop_restated_sentences(quote,())
        if fixed==quote or literal(fixed) not in literal(free):return text,{}
        moved[quote]=fixed
    return free,moved


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
