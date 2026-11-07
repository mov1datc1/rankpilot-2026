import copy
import unittest
from unittest.mock import patch
from pydantic import ValidationError
from core.candidate_evidence import bind_public_quote
from core.editorial_repair import repair_result_contract, project_repair_result, repair_development
from test_editorial_development import PACKAGE,STRATEGY,DEV


class OutputBindingAndRepairScopeTests(unittest.TestCase):
    def test_known_name_prefix_binds_only_its_actual_full_name_assertion(self):
        bio='Sofia Vega brings experience in workforce governance.'
        quote='Sofia brings experience in workforce governance.'
        result=bind_public_quote(quote,bio,'Sofia Vega')
        self.assertIn(result,bio);self.assertNotEqual(result,quote)
        self.assertEqual(bind_public_quote(quote,bio,'Sofia Prado'),quote)

    def test_additive_also_binds_without_rewriting_a_bio(self):
        bio='He also leads constitutional litigation that restored the right of defence.'
        quote='He leads constitutional litigation that restored the right of defence.'
        self.assertIn(bind_public_quote(quote,bio,'Luis Prado'),bio)

    def test_negation_tense_figures_roles_and_other_names_never_fuzzy_match(self):
        for quote,bio in [
            ('Sofia led the workforce negotiations.','Sofia Vega did not lead the workforce negotiations.'),
            ('Sofia led the workforce negotiations.','Sofia Vega may lead the workforce negotiations.'),
            ('Sofia managed 10 labour proceedings.','Sofia Vega managed 20 labour proceedings.'),
            ('Sofia is the department head.','Sofia Vega is the department associate.'),
            ('Luis led the workforce negotiations.','Sofia Vega led the workforce negotiations.')]:
            self.assertEqual(bind_public_quote(quote,bio,'Sofia Vega'),quote)

    def test_ambiguous_modified_span_remains_unbound(self):
        quote='He leads collective labour negotiations.'
        bio='He also leads collective labour negotiations. He also leads collective labour negotiations.'
        self.assertEqual(bind_public_quote(quote,bio),quote)

    def test_every_authorized_field_has_one_exclusive_typed_outcome(self):
        targets={'b10':{'current_value':'Old overview.'},'c2':{'current_value':'Old request.'}}
        schema=repair_result_contract(targets)
        answer={'results':{'T01':{'path':'b10','status':'corrected','value':'Current overview.','reason':'Source-backed correction.'},
                           'T02':{'path':'c2','status':'unresolved','reason':'A required source conflict remains.'}},'source_notes':[]}
        parsed=schema.model_validate(answer).model_dump();projected=project_repair_result(parsed,targets)
        self.assertEqual([c['path'] for c in projected['corrections']],['b10'])
        self.assertTrue(projected['unresolved'][0].startswith('c2:'))
        for bad in ({**answer,'unresolved':['A category outside these fields is pending.']},
                    {'results':{'T01':answer['results']['T01']},'source_notes':[]}):
            with self.assertRaises(ValidationError):schema.model_validate(bad)
        bad=copy.deepcopy(answer);bad['results']['T02']['value']='A field cannot be both blocked and corrected.'
        with self.assertRaises(ValidationError):schema.model_validate(bad)

    def test_out_of_scope_source_note_does_not_undo_a_valid_generated_correction(self):
        proposal=copy.deepcopy(DEV);proposal['b10']='Old generated overview.'
        targets={'b10':{'current_value':proposal['b10'],'source_evidence':{'original':PACKAGE['matters'][0]['source_excerpt']}}}
        answer={'results':{'T01':{'path':'b10','status':'corrected','value':DEV['b10'],'reason':'Preserve source-backed work.'}},
                'source_notes':['An already non-nominated lawyer has no confirmed seniority.']}
        with patch('core.review_graph.invoke_role',return_value=(answer,[{'usage':{'total_tokens':10}}])):
            result=repair_development({'package':PACKAGE,'strategy':STRATEGY},proposal,targets)
        self.assertTrue(result['development_validated']);self.assertEqual(result['development'],DEV)
        self.assertEqual(result['repair_report']['source_notes'],answer['source_notes'])
        self.assertNotIn('approved_artifact',result)
