"""The editorial owner's acceptance rubric, applied to a saved run before a release.

v1.0.127: the reviews of Labour, Tax and Public Law (24-27 Nov) were the only test
of editorial strategy, so each one found the next gap. This rubric states their
criteria once and lets a saved Submission and Audit be scored against them for the
cost of one judge call, instead of a new full run.

    python -m evals.editorial_rubric <submission.json> --dry-run      # cost only
    python -m evals.editorial_rubric <submission.json> --max-usd 0.6  # one judge call

The run data is private: never commit it, and keep the output beside it.
"""
import argparse
import base64
import io
import json
import sys
from typing import List, Literal

from pydantic import BaseModel, Field

from core.editorial_strategy import SPEC

CRITERIA = {
    'b10_distinctiveness': 'B10 explains what distinguishes the practice in its market, carried by its team, with mandates as evidence of that thesis; it is not a list of mandates and the team is woven into each capability.',
    'original_strategy': 'When the original B10/C2 has a specific, well-argued thesis, the generated sections keep it as their thesis, keep its distinctive formulations and strengthen it with evidence; they do not replace it with a weaker generic one.',
    'c2_function': 'C2 is feedback on the directory coverage: it starts from the current coverage, states which aspect deserves reconsideration and the evidence for it, concludes once without begging, and does not present the practice again or repeat B10.',
    'b9_argument': 'Each B9 is an individual argument (role, judgement, autonomy, client trust, legal sophistication of the person\'s own work), proportionate in length, with mandates as proof in a clause; it does not re-tell matters told in D/E.',
    'candidacy_advice': 'The Audit respects the ranking the firm declares for each lawyer, never proposes an entry band for a declared-ranked lawyer, and distinguishes inviable, insufficiently documented (with the specific information to obtain) and development-potential candidacies.',
    'matter_narratives': 'Matters open with the legal problem, its complexity and the firm\'s contribution; results are their core, in context; adverse or procedural outcomes come after the work; routine filings or permits are not inflated by a notable client or a difficult jurisdiction; density, not length.',
    'audit_submission_coherence': 'Material inconsistencies the Audit identifies are not reproduced in the Submission: they are marked pending confirmation, never resolved by inference; original form fields and names are preserved.',
    'complementarity': 'B9, B10, C2 and the work highlights work as parts of one strategy with different functions, without repeating each other.',
}


class Score(BaseModel):
    criterion: Literal[tuple(CRITERIA)]
    score: int = Field(description='1 (fails the criterion) to 5 (fully meets it).')
    evidence: str = Field(description='The exact passage of the output that decides the score.')
    fix: str = Field(description='The single most important correction, or empty when the score is 5.')


class Evaluation(BaseModel):
    scores: List[Score]
    overall: str = Field(description='Two sentences: what an expert reviewer would say first about this submission.')


TASK = ('You are a senior legal-directory submissions consultant reviewing an AI-generated Chambers '
        'submission and its internal strategic Audit against the firm\'s own original. Score each criterion '
        'once, quoting the decisive passage. Judge editorial strategy, not grammar.\n\nCRITERIA:\n' +
        '\n'.join(f'- {k}: {v}' for k, v in CRITERIA.items()) + '\n\nTHE METHOD THE TOOL FOLLOWS:\n' + SPEC)


def audit_text(data):
    """The Audit DOCX text from a saved artifact, or an empty string."""
    for key in ('approved_artifact', 'available_artifact', 'draft_artifact'):
        encoded = ((data.get(key) or {}).get('audit_base64') or '')
        if encoded:
            try:
                from docx import Document
                return '\n'.join(p.text for p in Document(io.BytesIO(base64.b64decode(encoded))).paragraphs if p.text.strip())
            except Exception:
                return ''
    return ''


def view(submission):
    data = submission.get('chambersData', submission)
    dev = data.get('editorial_development') or {}
    clients = {m.get('id'): m.get('client') for m in data.get('matters', [])}
    return {
        'practice_area': data.get('practice_area'),
        'original_b10': data.get('original_b10', ''), 'original_c2': data.get('original_c2', ''),
        'declared_rankings': {l.get('name'): l.get('current_ranking') for l in data.get('lawyers', [])},
        'b10': dev.get('b10', ''), 'c2': dev.get('c2', ''),
        'b9': [{'name': c.get('name'), 'decision': c.get('recommendation'), 'state': c.get('candidacy_state'),
                'proposed_category': c.get('suggested_ranking'), 'bio': c.get('submission_bio', '')} for c in dev.get('candidates', [])],
        'matters': [{'client': clients.get(m.get('matter_id')), 'text': m.get('text', '')} for m in dev.get('matters', [])],
        'audit': audit_text(data)[:30000],
    }


def estimate(payload):
    tokens_in = (len(TASK) + len(json.dumps(payload, ensure_ascii=False))) // 3.6
    return tokens_in, round(tokens_in * 4 / 1e6 + 6000 * 20 / 1e6, 3)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('submission')
    parser.add_argument('--max-usd', type=float, default=0.6)
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--out')
    args = parser.parse_args()
    payload = view(json.load(open(args.submission, encoding='utf-8')))
    tokens, usd = estimate(payload)
    print(f'input ≈{int(tokens)} tokens, estimated ≤{usd} USD', file=sys.stderr)
    if args.dry_run:
        return
    if usd > args.max_usd:
        sys.exit(f'estimated {usd} USD exceeds --max-usd {args.max_usd}; not called')
    from utils.model_factory import create_chat_model
    model = create_chat_model('judge').with_structured_output(Evaluation, include_raw=True)
    result = model.invoke([('system', TASK), ('user', json.dumps(payload, ensure_ascii=False))])
    usage = getattr(result.get('raw'), 'usage_metadata', None) or {}
    cost = round((usage.get('input_tokens', 0) * 4 + usage.get('output_tokens', 0) * 20) / 1e6, 4)
    output = {'evaluation': result['parsed'].model_dump() if result.get('parsed') else None, 'usage': usage, 'usd': cost}
    text = json.dumps(output, ensure_ascii=False, indent=1)
    if args.out:
        open(args.out, 'w', encoding='utf-8').write(text)
    print(text)


if __name__ == '__main__':
    main()
