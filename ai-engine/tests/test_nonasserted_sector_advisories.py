import copy
import unittest
from pydantic import ValidationError
from core.register_review import nonasserted_sector_advisories
from core.review_graph import Defect


def fixture():
    quote='The firm managed employment proceedings and preventive governance.'
    package={'rendered_artifact':quote,'rendered_audit':'The team handled employment litigation.',
        'matters':[{'id':'m1','source_excerpt':'The client manages private security workforces.',
            'confidentialityEvidence':{'client_register':[{'quote':'Example Client | Private education'}]}}]}
    defect={'code':'SOURCE_CONFLICT','severity':'warning','scope':'submission','matter_id':'m1',
        'message':'Withdraw the optional descriptor.','conflict_basis':'source_vs_source',
        'conflict_resolution':'omit_nonessential_descriptor','conflicting_artifact_term':'private security',
        'source_quote':'Private education','artifact_quote':quote,'field_path':'client_sector',
        'artifact_claim_kind':'factual_assertion'}
    check={'relationship':'conflicting','register_quote':'Private education','narrative_quote':'private security workforces',
        'nonessential_sector':True,'claims':[{'scope':'submission','artifact_quote':quote,'conflicting_artifact_term':'private security'}]}
    verdict={'passed':True,'defects':[defect],'register_checks':{'m1':check},'acceptance':[], 'case_checks':{'own_proof':'unchanged'}}
    return package,verdict


class NonassertedSectorAdvisoryTests(unittest.TestCase):
    def test_redundant_optional_warning_retains_the_register_and_every_acceptance_decision(self):
        p,v=fixture();before=copy.deepcopy((p,v))
        with self.assertRaises(ValidationError):Defect.model_validate(v['defects'][0])
        fixed,notes=nonasserted_sector_advisories(v,p)
        self.assertEqual(fixed['defects'],[]);self.assertEqual(len(notes),1)
        for field in ('passed','case_checks','acceptance','register_checks'):self.assertEqual(fixed[field],v[field])
        self.assertEqual((p,v),before)

    def test_never_dismisses_critical_outcome_alias_role_or_client_questions(self):
        for change in ({'severity':'critical'},{'field_path':'outcome'},
            {'conflict_resolution':'preserve_source_aliases'},{'field_path':'role'},
            {'field_path':'value'},{'owner':'user'}):
            p,v=fixture();v['defects'][0].update(change)
            fixed,notes=nonasserted_sector_advisories(v,p)
            self.assertEqual(fixed,v);self.assertEqual(notes,[])

    def test_a_term_asserted_in_either_exact_word_still_requires_review(self):
        for field in ('rendered_artifact','rendered_audit'):
            p,v=fixture();p[field]+=' A private security employer.'
            self.assertEqual(nonasserted_sector_advisories(v,p),(v,[]))

    def test_absent_or_foreign_evidence_cannot_dismiss_a_diagnostic(self):
        for change in ('register','narrative','quote','duplicate','sector','artifact'):
            p,v=fixture();c=v['register_checks']['m1']
            if change=='register':c['register_quote']='Other industry'
            elif change=='narrative':c['narrative_quote']='Other client facts'
            elif change=='quote':v['defects'][0]['artifact_quote']='Not in the exact Word.'
            elif change=='duplicate':c['claims']=[]
            elif change=='sector':c['nonessential_sector']=False
            else:p['rendered_audit']=''
            self.assertEqual(nonasserted_sector_advisories(v,p),(v,[]))

    def test_false_acceptance_never_becomes_passed_and_other_defects_survive(self):
        p,v=fixture();v['passed']=False;v['acceptance']=[{'criterion':'source_fidelity','status':'failed'}]
        critical={**v['defects'][0],'severity':'critical'};v['defects'].append(critical)
        fixed,notes=nonasserted_sector_advisories(v,p)
        self.assertFalse(fixed['passed']);self.assertEqual(fixed['acceptance'],v['acceptance'])
        self.assertEqual(fixed['defects'],[critical]);self.assertEqual(len(notes),1)

    def test_source_only_optional_warning_keeps_grounded_register_without_fake_artifact_claim(self):
        p,v=fixture();d=v['defects'][0];d.update(scope='facts',artifact_quote='',conflicting_artifact_term=None)
        v['register_checks']['m1']['claims']=[]
        before=copy.deepcopy((p,v))
        fixed,notes=nonasserted_sector_advisories(v,p)
        self.assertEqual(fixed['defects'],[]);self.assertEqual(len(notes),1)
        for key in ('passed','case_checks','acceptance','register_checks'):self.assertEqual(fixed[key],v[key])
        self.assertEqual((p,v),before)

    def test_source_only_warning_cannot_hide_claims_critical_or_unbound_conflicts(self):
        for change in ('critical','user','field','scope','claim','reg','nar','rendered','output_reg','output_nar'):
            p,v=fixture();d=v['defects'][0];d.update(scope='facts',artifact_quote='',conflicting_artifact_term=None)
            c=v['register_checks']['m1'];c['claims']=[]
            if change=='critical':d['severity']='critical'
            elif change=='user':d['owner']='user'
            elif change=='field':d['field_path']='outcome'
            elif change=='scope':d['scope']='submission'
            elif change=='claim':c['claims']=[{'artifact_quote':'Still asserted'}]
            elif change=='reg':c['register_quote']='foreign register'
            elif change=='nar':c['narrative_quote']='foreign narrative'
            elif change=='rendered':p['rendered_audit']=''
            elif change=='output_reg':p['rendered_audit']+=' Private education.'
            else:p['rendered_artifact']+=' private security workforces.'
            self.assertEqual(nonasserted_sector_advisories(v,p),(v,[]),change)
