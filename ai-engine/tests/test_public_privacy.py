import copy
import unittest
from unittest.mock import patch
from core.public_privacy import metric_facts, public_privacy_findings
from core.editorial_development import development_errors
from core.editorial_repair import repair_targets, repair_rejected_development
from test_editorial_development import PACKAGE,STRATEGY,DEV

class PublicPrivacyTests(unittest.TestCase):
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
