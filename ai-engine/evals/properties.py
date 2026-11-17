"""Offline property evaluation of a saved case: no provider call, no data leaves the machine.

Usage (data stays local; pass paths to private saved submissions):
    PYTHONPATH=. python -m evals.properties path/to/submission.json [...] [--polish]

Each property is a deterministic check of an expectation Ángela has stated.
The bench measures a saved development and, with --polish, the same development
after the prose rules, so a rule change is evaluated in seconds.
"""
import json
import re
import sys

# Any lead-partner form vocabulary in public prose (named, serves as, is lead partner, As lead partner).
ROLE_FORM = re.compile(r'\b(?:co-?)?lead(?:-|\s)partners?\b', re.I)
# "said to have been taken" states an unproven allegation and is correct; only
# narration about the record, or hedging an achieved act, is auditor voice.
HEDGE = re.compile(r'\bThe (?:record|source|form) (?:confirms|shows|states|records) that|\b(?:described|reported|said) (?:as having|to have)\s+(?!been\b)\w+ed\b', re.I)


def load(path):
    data = json.load(open(path))
    chambers = data.get('chambersData') or data
    state = (chambers.get('review_checkpoint') or {}).get('state') or {}
    package = {**chambers, 'filing_details': {'heads': chambers.get('departmentHeads') or [], 'num_partners': chambers.get('numPartners'),
               'num_lawyers': chambers.get('numLawyers')}, 'b10_source': chambers.get('original_b10', ''),
               'c2_source': chambers.get('original_c2', ''), 'practice_area': chambers.get('metadata', {}).get('practice_area') or chambers.get('practiceArea')}
    return package, state.get('strategy') or {}, state.get('development') or {}


def words(text):
    return len(str(text or '').split())


def measure(package, strategy, proposal):
    from core.editorial_development import submission_voice_paths
    from core.editorial_execution import missing_head_bios, personal_case_errors
    from core.public_privacy import public_privacy_findings
    from core.prose_rules import VALUE_LINE
    public = [proposal.get('b10', ''), proposal.get('c2', '')] + [c.get('submission_bio', '') for c in proposal.get('candidates', [])]
    matters = [m.get('text', '') for m in proposal.get('matters', [])]
    literal = sum('literalmente' in e for c in proposal.get('candidates', []) for e in personal_case_errors(package, c))
    try:
        privacy = len(public_privacy_findings(package, strategy, proposal))
    except Exception:
        privacy = None
    nominated = [c for c in proposal.get('candidates', []) if c.get('recommendation') == 'present']
    return {
        'lead_form_phrases': sum(len(ROLE_FORM.findall(t)) for t in public + matters),
        'auditor_hedges': sum(len(HEDGE.findall(t)) for t in public + matters),
        'voice_fields': len(submission_voice_paths(proposal)),
        'headship_missing': len(missing_head_bios(package, proposal)),
        'non_literal_personal_bindings': literal,
        'privacy_findings': privacy,
        'duplicated_value_lines': sum(bool(VALUE_LINE.search(t)) for t in matters),
        'b10_words': words(proposal.get('b10')), 'b10_original_words': words(package.get('b10_source')),
        'c2_words': words(proposal.get('c2')), 'c2_original_words': words(package.get('c2_source')),
        'nominated_b9_words': [words(c.get('submission_bio')) for c in nominated],
        'over_1000_words': sum(words(t) > 1000 for t in public),
    }


def main(argv):
    polish = '--polish' in argv
    paths = [a for a in argv if not a.startswith('--')]
    for path in paths:
        package, strategy, proposal = load(path)
        if not proposal:
            print(path, 'sin desarrollo guardado'); continue
        print('==', path.split('/')[-1])
        before = measure(package, strategy, proposal)
        print('   antes  ', json.dumps(before, ensure_ascii=False))
        if polish:
            from core.prose_rules import polish_proposal
            after_proposal, report = polish_proposal(package, proposal)
            print('   después', json.dumps(measure(package, strategy, after_proposal), ensure_ascii=False))
            print('   campos cambiados', len(report['fields']))


if __name__ == '__main__':
    main(sys.argv[1:])
