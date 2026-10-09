"""Cross-document candidate detection and evidence-bound classification review.

A selected client in the reserves section must be explicitly identified as selected
or participate in a comparison. This makes implicit reserve lists unambiguous.
"""
import re
import unicodedata


def normalized(text):
    return ''.join(c for c in unicodedata.normalize('NFKD', str(text)) if not unicodedata.combining(c)).casefold()


def portfolio_defects(package, strategy, letter):
    register = {m['id']: m for m in package.get('matters', [])}
    decisions = {m['matter_id']: m['disposition'] for m in strategy.get('matters', [])}
    aliases = {}
    for mid, matter in register.items():
        client = str(matter.get('client') or '').strip()
        names = [client]
        # Legal suffixes are not substantive identifiers. Never strip common nouns.
        short = re.split(r',|\s+(?:S\.A\.|SpA\b|S\.C\.|Ltd\b|LLC\b)', client, maxsplit=1, flags=re.I)[0].strip()
        names.append(short)
        for name in names:
            if len(name) >= 4:
                aliases.setdefault(normalized(name), set()).add(mid)
    defects = []
    for field, allowed in [('portfolio', {'core'}), ('evidence_gaps', {'reserve', 'excluded'})]:
        text = letter.get(field, '')
        for segment in re.split(r'(?<=[.;])\s+|\n+', text):
            lower = normalized(segment)
            for name, ids in aliases.items():
                if len(ids) != 1 or not re.search(r'(?<!\w)' + re.escape(name) + r'(?!\w)', lower):
                    continue
                mid = next(iter(ids)); actual = decisions.get(mid)
                if not actual or actual in allowed:
                    continue
                # Explicit comparisons are legitimate in either section.
                comparison = re.search(r'\b(?:frente a|a diferencia de|en comparacion|comparad[oa]|detras de|superpon\w*|solap\w*|menos que|mas que|compared with|compared to|unlike|overlaps with|behind)\b', lower)
                explicit_core = actual=='core' and re.search(re.escape(name) + r'\s*(?:es|esta|is|remains)?\s*(?:parte del nucleo|core|seleccionad[oa])\b', lower)
                explicit_wrong = re.search(re.escape(name) + r'\s*(?:(?:queda|permanece|esta|is|remains)\s+)?(?:en reserva|excluid[oa]|excluded|in reserve)\b', lower)
                if ((comparison and comparison.end() <= lower.find(name)) or explicit_core) and not explicit_wrong:
                    continue
                defects.append({'code':'SELECTION_MISMATCH','severity':'critical','scope':'letter','owner':'rankpilot','matter_id':mid,'field_path':field,
                    'message':f"El Audit sitúa a {register[mid].get('client')} en {field}, pero su clasificación guardada es {actual}. Corrige la redacción o explicita la comparación sin cambiar la selección.",
                    'source_quote':f'{mid}: {actual}','artifact_quote':segment.strip()})
    unique = {(d['matter_id'], d['field_path'], d['artifact_quote']): d for d in defects}
    return list(unique.values())


def verify_portfolio_consistency(state, letter):
    """Interpret only candidate clauses, then compare their meaning with saved IDs.

    Mentioning a core matter in a reserves comparison is not a contradiction.
    Model output must cover every candidate with literal textual evidence.
    """
    from typing import Literal
    from pydantic import BaseModel
    from core.review_graph import invoke_role

    candidates = portfolio_defects(state.get('package', {}), state.get('strategy', {}), letter)
    if not candidates:
        return [], state.get('trace', [])

    class Interpretation(BaseModel):
        index: int
        disposition: Literal['core', 'reserve', 'excluded', 'comparison', 'not_classified', 'ambiguous']
        reason: str

    class ClauseReview(BaseModel):
        interpretations: list[Interpretation]

    result, trace = invoke_role(state, 'portfolio_reviewer', ClauseReview,
        'Interpret the portfolio classification actually asserted for EACH named matter in its quoted clause, considering ONLY that clause’s own section as context. Other sections can contradict this section: never use their classification to excuse a local contradiction. A shared reserve/exclusion introductory predicate applies to a following coordinated list even when the list sentence describes legal work rather than repeating the word reserve. Do not judge factual outcomes or rewrite prose. A client listed among reserves under an exclusion heading may be implicitly classified reserve; a statement that all named clients remain selected means core. Mere mention, procedural gaps, or a genuine comparison with a reserve does not classify a selected matter as reserved. Return comparison for a comparative reference without reclassification. Return not_classified for a factual evidence gap or sector discrepancy that makes NO membership claim. Return ambiguous only when portfolio membership is actually asserted but its meaning is unclear, such as an unclear shared inclusion/exclusion predicate. Preserve negation and shared predicates in lists. Identify evidence by the supplied index; the application retains its exact original clause, so do not copy or paraphrase quotations. One interpretation per index, no omissions. Do not infer classification from the section heading alone.',
        {'clauses':[{'index':i,'matter':next((m.get('client') for m in state.get('package',{}).get('matters',[]) if m['id']==d['matter_id']),''),'field':d['field_path'],'section_context':letter.get(d['field_path'],''),'clause':d['artifact_quote']} for i,d in enumerate(candidates)]})
    decisions={m['matter_id']:m['disposition'] for m in state.get('strategy',{}).get('matters',[])}
    seen=set(); defects=[]
    for item in result.get('interpretations',[]):
        i=item['index']
        if i in seen or not 0<=i<len(candidates) or not item.get('reason'):
            raise ValueError('Portfolio classification review has invalid clause references')
        seen.add(i)
        # Ambiguous membership in a portfolio/reserves section needs generated
        # clarification, never a new question about the saved selection.
        if item['disposition'] not in ('comparison','not_classified',decisions[candidates[i]['matter_id']]):
            defects.append({**candidates[i],'message':candidates[i]['message']+' '+('La pertenencia queda ambigua; explicita la clasificación guardada sin alterar los hechos. ' if item['disposition']=='ambiguous' else '')+item['reason']})
    if len(seen)!=len(candidates):
        raise ValueError('Portfolio classification review omitted a candidate clause')
    return defects, trace
