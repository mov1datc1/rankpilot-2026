import copy
import unittest
from unittest.mock import patch
from core.public_privacy import metric_facts, public_privacy_findings
from core.editorial_development import development_errors
from core.editorial_repair import repair_targets, repair_rejected_development
from test_editorial_development import PACKAGE,STRATEGY,DEV

class PublicPrivacyTests(unittest.TestCase):
    def test_single_confidential_metric_with_a_case_context_is_batched_before_render(self):
        package,proposal,_=self.fixture()
        source='The team led post-acquisition integration for more than 4,200 employees.'
        package['matters'][0]['source_excerpt']=source
        package['matters'][0]['rawNotes']=source
        proposal['b10']='The practice advises employers on preventive compliance.'
        proposal['c2']='The team led post-acquisition integration for more than 4,200 employees.'
        proposal['candidates'][0]['submission_bio']='She led integration of 4,200 employees.'
        findings=public_privacy_findings(package,STRATEGY,proposal)
        self.assertEqual({f['path'] for f in findings},{'c2','candidates/0/submission_bio'})
        self.assertTrue(all(len(f['metrics'])==1 for f in findings))
        targets=repair_targets(package,STRATEGY,proposal)
        self.assertIn('m1',targets['c2']['privacy_matter_ids'])
        self.assertEqual(proposal['matters'][0]['text'],self.fixture()[2])

    def test_one_exact_private_amount_with_amparo_or_sensitive_investigation_is_not_missed(self):
        for text in ('The firm handles an amparo in litigation with exposure of MXN12 million.',
                     'The firm led an internal employment investigation preventing litigation of MXN640,000.'):
            package,proposal,_=self.fixture()
            package['matters'][0].update(source_excerpt=text,rawNotes=text)
            proposal.update(b10='The team advises employers.',c2=text)
            proposal['candidates'][0]['submission_bio']='She advises on employment law.'
            self.assertEqual([f['path'] for f in public_privacy_findings(package,STRATEGY,proposal)],['c2'])

    def test_equal_numbers_in_different_known_currencies_are_not_the_same_case_metric(self):
        package,proposal,_=self.fixture()
        package['matters'][0].update(source_excerpt='The team leads amparo litigation concerning MXN12 million.',rawNotes='')
        proposal.update(b10='The team advises employers.',c2='The team leads amparo litigation concerning USD12 million.')
        proposal['candidates'][0]['submission_bio']='She advises on employment law.'
        self.assertEqual(public_privacy_findings(package,STRATEGY,proposal),[])

    def test_privacy_postcondition_retries_only_the_remaining_public_field(self):
        from core.editorial_repair import repair_development
        package=copy.deepcopy(PACKAGE);proposal=copy.deepcopy(DEV)
        source='The firm handles an amparo in litigation with exposure of MXN12 million.'
        package['matters'][0].update(publication_route='E',resolved_publication_status='confidential',source_excerpt=str(package['matters'][0].get('source_excerpt') or package['matters'][0].get('rawNotes') or '')+'\n'+source)
        proposal['c2']=source
        before=copy.deepcopy((package,proposal['matters']))
        targets=repair_targets(package,STRATEGY,proposal)
        self.assertEqual(set(targets),{'c2'})
        def invoke(state,role,schema,instruction,payload):
            self.assertEqual(set(payload['repair_targets']),{'c2'})
            n=len(state.get('trace',[]))
            text=source+' The client remained advised.' if n==0 else 'The team handles constitutionally significant employment litigation and advises on financial exposure.'
            return {'corrections':[{'path':'c2','value':text,'reason':'Retain meaningful work, generalize the public financial footprint.'}],'unresolved':[]},list(state.get('trace',[]))+[{'role':'repair','usage':{'total_tokens':10}}]
        with patch('core.review_graph.invoke_role',side_effect=invoke) as model:
            result=repair_development({'package':package,'strategy':STRATEGY},proposal,targets)
        self.assertEqual(model.call_count,2)
        self.assertEqual(result['repair_report']['surgical_retries'],1)
        self.assertTrue(result['development_validated'])
        self.assertEqual((package,result['development']['matters']),before)
        self.assertNotIn('approved_artifact',result)

    def fixture(self):
        package=copy.deepcopy(PACKAGE);proposal=copy.deepcopy(DEV)
        source='The firm manages 35 active labour proceedings for more than 5,000 employees across six Mexican states.'
        package['matters'][0].update(publication_route='E',resolved_publication_status='confidential',source_excerpt=source)
        proposal['matters'][0].update(text=source,decisive_source_quotes=[source])
        proposal['candidates'][0]['supporting_matters'][0]['source_quote']=source
        proposal['b10']=source;proposal['c2']=source;proposal['candidates'][0]['submission_bio']=source
        return package,proposal,source

    def test_all_public_combinations_are_collected_together_and_e_is_immutable(self):
        package,proposal,source=self.fixture();before=copy.deepcopy((package,proposal))
        findings=public_privacy_findings(package,STRATEGY,proposal)
        self.assertEqual({f['path'] for f in findings},{'b10','c2','candidates/0/submission_bio'})
        self.assertEqual(len(findings),3)
        targets=repair_targets(package,STRATEGY,proposal)
        self.assertEqual(set(targets),{'b10','c2','candidates/0/submission_bio'})
        self.assertTrue(any('métricas confidenciales' in e for e in development_errors(package,STRATEGY,proposal)))
        self.assertEqual((package,proposal),before)
        self.assertEqual(proposal['matters'][0]['text'],source)

    def test_values_percentages_and_operational_counts_normalize_without_dates(self):
        facts=metric_facts('In 2026 under article 35, exposure fell from MXN 1.06 million to MXN 20,000, a 98% reduction. Three inspections covered 5,000 employees.')
        for fact in [('amount','1.06E+6'),('amount','2E+4'),('percent','98'),('inspections','3'),('workforce','5E+3')]:self.assertIn(fact,facts)
        self.assertEqual(metric_facts('Article 35 and section 2026. The lawyer qualified in 2013.'),set())
        self.assertIn(('amount','2E+4'),metric_facts('MXN 20.000,00'))

    def test_confirmed_public_matters_single_metric_and_neutral_prose_do_not_fail(self):
        package,proposal,_=self.fixture()
        package['matters'][0].update(publication_route='D',resolved_publication_status='publishable',publish_status='publishable')
        self.assertEqual(public_privacy_findings(package,STRATEGY,proposal),[])
        package['matters'][0]['publication_route']='E'
        for path in ('b10','c2'):proposal[path]='The firm represents employers with more than 5,000 employees.'
        proposal['candidates'][0]['submission_bio']='She leads workforce integration and labour litigation across multiple facilities.'
        self.assertEqual(public_privacy_findings(package,STRATEGY,proposal),[])

    def test_multiple_private_matters_sharing_a_public_field_keep_all_sources_once(self):
        package,proposal,source=self.fixture();other={'id':'m3','publication_route':'E','source_excerpt':'The firm reduced a claim from MXN 4 million to MXN 30,000.'}
        package['matters'].append(other);strategy=copy.deepcopy(STRATEGY);strategy['matters'].append({'matter_id':'m3','disposition':'core'})
        proposal['b10']+=' '+other['source_excerpt']
        targets=repair_targets(package,strategy,proposal)
        self.assertEqual({m['id'] for m in targets['b10']['source_evidence']['affected_confidential_matters']},{'m1','m3'})
        self.assertNotIn('m2',str(targets['b10']['source_evidence']))

    def test_later_one_field_finding_cannot_discard_other_preflight_privacy_targets(self):
        package,proposal,source=self.fixture()
        defect={'code':'UNSUPPORTED_CLAIM','owner':'rankpilot','scope':'submission','severity':'critical','matter_id':'m1','field_path':'b10','artifact_quote':source,'message':'Generalize confidential metrics in B10.'}
        with patch('core.editorial_repair.repair_development',return_value={}) as repair:
            repair_rejected_development({'package':package,'strategy':STRATEGY},proposal,[defect])
        targets=repair.call_args.args[2]
        self.assertEqual(set(targets),{'b10','c2','candidates/0/submission_bio'})
        self.assertIn('affected_confidential_matters',targets['b10']['source_evidence'])

if __name__=='__main__':unittest.main()
