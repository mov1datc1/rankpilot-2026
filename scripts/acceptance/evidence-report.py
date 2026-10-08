"""Offline acceptance evidence inventory. Does not call models or approve delivery.

Usage: python scripts/acceptance/evidence-report.py PRIVATE_EVIDENCE_DIRECTORY
The directory holds CASE-writer.json, CASE-rendered.json and CASE-artifact-review.json.
All output stays in that private directory. No client data is embedded in this script.
"""
import hashlib
import json
import sys
from pathlib import Path


def read(path):
    return json.loads(path.read_text()) if path.exists() else {}


def inspect_case(directory, case):
    state = read(directory / f'{case}-writer.json')
    rendered = read(directory / f'{case}-rendered.json')
    review = read(directory / f'{case}-artifact-review.json')
    checks = []
    for artifact in rendered.get('files', []):
        path = directory / f'{case}-{artifact["kind"]}.docx'
        digest = hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else None
        reviewed = next((f for f in review.get('artifacts', []) if f['kind'] == artifact['kind']), {})
        checks.append({'kind': artifact['kind'], 'sha256': digest,
                       'matches_rendered': digest == artifact.get('sha256'),
                       'matches_reviewed': digest is not None and digest == reviewed.get('sha256')})
    judge = review.get('result', {}).get('judge', {})
    rendered_state = rendered.get('state', {})
    checkpoint_matches_rendered = all(
        state.get(key) == rendered_state.get(key)
        for key in ('strategy', 'development', 'letter')
    )
    current_pair_passed = (len(checks) == 2 and all(c['matches_rendered'] and c['matches_reviewed'] for c in checks)
                           and checkpoint_matches_rendered
                           and judge.get('passed') is True
                           and not any(d.get('severity') == 'critical' for d in judge.get('defects', [])))
    traces = state.get('trace', [])
    return {
        'case': case, 'source_matter_count': len(state.get('package', {}).get('matters', [])),
        'source_lawyer_count': len(state.get('package', {}).get('lawyers', [])),
        'stage_validation': {k: state.get(k) for k in ('selection_validated', 'selection_review_validated', 'development_validated', 'writer_validated')},
        'artifacts': checks, 'current_word_pair_review_passed': current_pair_passed,
        'checkpoint_matches_rendered': checkpoint_matches_rendered,
        'review_error': review.get('exception'), 'defects': judge.get('defects', []),
        'trace_roles_in_checkpoint': [t.get('role') for t in traces],
        'rag_sources_in_checkpoint': sorted({r['source'] for t in traces for r in t.get('retrieved_rules', []) if r.get('source')}),
        'node_events': state.get('node_events', []),
        'repairs': {k: state.get(k) for k in ('selection_repair_report', 'repair_report', 'letter_repair_report')},
        'acceptance_status': 'incomplete',
        'remaining_manual_gates': ['Reconcile original sources and saved human confirmations',
                                   'Inspect every rendered Word page and executive Audit length',
                                   'Assess all frozen criteria and adversarial controls',
                                   'Verify deployed web workflow and execution/reuse ledger'],
    }


def main():
    directory = Path(sys.argv[1]).resolve()
    cases = [p.name.removesuffix('-writer.json') for p in sorted(directory.glob('*-writer.json'))]
    result = {'purpose': 'Evidence inventory, not delivery approval',
              'criteria_version': 'angela-acceptance-2026-10-08-v1',
              'cases': [inspect_case(directory, case) for case in cases],
              'acceptance_status': 'incomplete'}
    (directory / 'evidence-report.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
    for case in result['cases']:
        print(case['case'], 'current Word review:', case['current_word_pair_review_passed'],
              'acceptance:', case['acceptance_status'])


if __name__ == '__main__':
    main()
