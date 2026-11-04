"""Replay observed autonomy failures locally. No provider calls or database writes."""
import argparse
import hashlib
import json
import sys
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'ai-engine'))
from utils.source_reconciliation import Fact, read_facts
from core.editorial_development import submission_voice_paths
from core.editorial_repair import repair_targets
from core.editorial_voice import rendered_voice_defects


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('ramos-snapshot', 'deforest-snapshot', 'submission-docx', 'output'):
        parser.add_argument('--'+name, required=True, type=Path)
    args = parser.parse_args()
    inputs = [args.ramos_snapshot, args.deforest_snapshot, args.submission_docx]
    before = {str(path): hashlib.sha256(path.read_bytes()).hexdigest() for path in inputs}
    ramos = json.loads(args.ramos_snapshot.read_text())['chambersData']
    conflicts = [m for m in ramos['matters'] if any(i['field']=='completionDate' and i['kind']=='conflicting' for i in m.get('extraction_issues', []))]
    assert conflicts, 'This replay needs the actual failed status extraction.'
    chronology = []
    for matter in conflicts:
        evidence = matter['extraction_evidence']['completionDate']
        fact = Fact(field='completionDate', status='conflicting', evidence=evidence['spans'])
        values, checked, issues = read_facts([fact], ('completionDate',), matter['source_excerpt'].splitlines())
        assert not issues and checked['completionDate']['quotes']==evidence['quotes']
        assert all(q in values['completionDate'] for q in evidence['quotes'])
        chronology.append({'matter_id':matter['id'], 'resolution':checked['completionDate']['resolution'], 'all_literal_quotes_preserved':True})
    data = json.loads(args.deforest_snapshot.read_text())['chambersData']
    development = data['editorial_development']
    affected = submission_voice_paths(development)
    assert affected and any(p.startswith('candidates/') for p in affected) and 'c2' in affected
    assert any(p.endswith('/completion_status') for p in affected)
    package = {'matters':data['matters'], 'lawyers':data.get('lawyers', []), 'b10_source':data.get('original_b10', '')}
    targets = repair_targets(package, data['review_checkpoint']['state']['strategy'], development)
    assert set(affected).issubset(targets)
    with ZipFile(args.submission_docx) as archive:
        xml = ElementTree.fromstring(archive.read('word/document.xml'))
        rendered = '\n'.join(''.join(p.itertext()) for p in xml.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'))
    defects = rendered_voice_defects({'rendered_artifact':rendered}, development)
    assert defects, 'The formerly approved defective Word must be rejected.'
    assert before == {str(path):hashlib.sha256(path.read_bytes()).hexdigest() for path in inputs}
    receipt = {'provider_calls':0, 'database_writes':0, 'inputs_unchanged':True,
               'input_sha256':before, 'chronology':chronology, 'development_repair_paths':affected,
               'known_defective_word_rejected':True, 'rendered_defect_count':len(defects)}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(receipt, indent=2)+'\n')
    print(json.dumps({k:v for k,v in receipt.items() if k not in ('input_sha256','chronology')}))


if __name__ == '__main__':
    main()
