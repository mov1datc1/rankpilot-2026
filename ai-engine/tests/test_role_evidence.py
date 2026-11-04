import copy
import unittest
from core.role_evidence import role_heading_is_not_promotion
from core.review_graph import calibrate_verdict
from core.portfolio_counts import wrong_generated_count, rendered_count_defects


class RoleEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.bio='Our founder works with associate attorneys, Ana Rivera and Luis Vega.'
        self.heading='D5 Lead partner\nAna Rivera'
        self.package={'b10_source':self.bio,'lawyers':[{'name':'Founder'}],
                      'matters':[{'id':'m','leadPartner':'Ana Rivera','source_excerpt':self.heading+'\nD6 Other team members\nLuis Vega'}],
                      'rendered_audit':'Ana Rivera — partner supporting this matter.'}
        self.defect={'code':'SOURCE_CONFLICT','severity':'critical','scope':'letter','matter_id':'m','field_path':'role',
                     'conflict_basis':'source_vs_source','source_quote':self.bio+'\n\n'+self.heading,
                     'artifact_quote':self.package['rendered_audit'],'message':'Check the added partner title.'}

    def test_template_heading_routes_the_generated_promotion_to_repair(self):
        before=copy.deepcopy(self.package)
        self.assertTrue(role_heading_is_not_promotion(self.defect,self.package))
        result=calibrate_verdict({'passed':False,'defects':[self.defect]},self.package)
        defect=result['defects'][0]
        self.assertEqual(defect['code'],'UNSUPPORTED_CLAIM');self.assertEqual(defect['owner'],'rankpilot')
        self.assertEqual(defect['severity'],'critical');self.assertFalse(result['passed'])
        self.assertEqual(self.package,before)

    def test_real_title_conflicts_candidates_and_unbound_quotes_remain_questions(self):
        for change in [
            {'lawyers':[{'name':'Ana Rivera'}]},
            {'b10_source':'Ana Rivera was promoted to partner.'},
            {'matters':[{'id':'m','leadPartner':'Ana Rivera','source_excerpt':'Ana Rivera is the lead partner.'}]},
            {'rendered_audit':'A different actual artifact.'},
        ]:
            package={**self.package,**change}
            self.assertFalse(role_heading_is_not_promotion(self.defect,package))
            self.assertEqual(calibrate_verdict({'passed':False,'defects':[self.defect]},package)['defects'][0]['owner'],'user')
        self.assertFalse(role_heading_is_not_promotion({**self.defect,'source_quote':'Invented associate attorneys Ana Rivera D5 Lead partner'},self.package))

    def test_reported_wrong_count_becomes_critical_only_against_canonical_core_and_literal_output(self):
        package={'rendered_audit':'El núcleo seleccionado de doce asuntos.'}
        strategy={'matters':[{'disposition':'core'} for _ in range(11)]}
        defect={'code':'UNSUPPORTED_CLAIM','severity':'warning','scope':'letter','field_path':'selected_matter_count','artifact_quote':package['rendered_audit']}
        self.assertTrue(wrong_generated_count(defect,package,strategy))
        result=calibrate_verdict({'passed':True,'defects':[defect]},package,strategy)
        self.assertFalse(result['passed']);self.assertEqual(result['defects'][0]['severity'],'critical')
        self.assertFalse(wrong_generated_count(defect,package,{'matters':[{'disposition':'core'} for _ in range(12)]}))
        self.assertFalse(wrong_generated_count({**defect,'artifact_quote':'A fabricated count.'},package,strategy))

    def test_exact_audit_count_guard_does_not_need_a_model_finding(self):
        from core.review_graph import editor
        from unittest.mock import patch
        text='El núcleo seleccionado de doce asuntos.'
        strategy={'matters':[{'disposition':'core'} for _ in range(11)]}
        state={'package':{'rendered_audit':text},'strategy':strategy,'letter':{'portfolio':text}}
        with patch('core.review_graph.invoke_role',return_value=({'passed':True,'defects':[]},[])) as model:
            result=editor(state)
        model.assert_called_once();self.assertFalse(result['judge']['passed'])
        self.assertEqual(result['judge']['defects'][0]['field_path'],'portfolio')
        self.assertEqual(rendered_count_defects({'rendered_audit':'A firm-wide portfolio of fifty matters.'},strategy,{'portfolio':'A firm-wide portfolio of fifty matters.'}),[])
