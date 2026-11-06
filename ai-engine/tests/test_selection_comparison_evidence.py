import copy
import unittest
from core.selection_review import review_selection, repair_selection, can_repair_selection


class ComparisonEvidenceTests(unittest.TestCase):
    def fixture(self):
        a={'id':'a','client':'Fictional Alpha','source_excerpt':'The team negotiated collective agreements and prevented a strike.'}
        b={'id':'b','client':'Fictional Beta','source_excerpt':'The team combined litigation and negotiations with competing unions.'}
        decision={'matter_id':'a','disposition':'core','source_quote':a['source_excerpt'],
                  'legal_understanding':'Collective bargaining mandate.','rationale':'Adds a distinct union-representation capability to the portfolio.'}
        peer={'matter_id':'b','disposition':'core','source_quote':b['source_excerpt'],
              'legal_understanding':'Union-representation litigation.','rationale':'Documents litigation and negotiations.'}
        state={'package':{'matters':[a,b]},'strategy':{'matters':[decision,peer],'hero_matter_id':'b'}}
        verdict={'checks':{'M01':{'status':'repair_required','explanation':'The other selected mandate already demonstrates the claimed distinct capability.',
            'source_quote':b['source_excerpt'],'decision_quote':decision['rationale'],
            'evidence_kind':'portfolio_comparison','comparison_reference':'M02'},
            'M02':{'status':'supported','explanation':'Source supports the selected mandate.','source_quote':''}}}
        return state,verdict

    def test_explicit_pair_binds_a_comparative_rejection_without_approving_selection(self):
        state,verdict=self.fixture();before=copy.deepcopy(state)
        result=review_selection(state,lambda *args:(verdict,[]))
        self.assertFalse(result['selection_diagnostic_invalid'])
        self.assertFalse(result['selection_review_validated'])
        self.assertTrue(can_repair_selection(result))
        self.assertEqual(result['selection_review']['checks']['a']['comparison_matter_id'],'b')
        self.assertEqual(state,before)

    def test_foreign_quotes_still_fail_for_unreferenced_or_noncomparative_claims(self):
        for change in [{'evidence_kind':'source','comparison_reference':None},
                       {'comparison_reference':None},{'comparison_reference':'M01'},
                       {'decision_quote':'core'}]:
            state,verdict=self.fixture();verdict['checks']['M01'].update(change)
            result=review_selection(state,lambda *args:(verdict,[]))
            self.assertTrue(result['selection_diagnostic_invalid'],change)
            self.assertFalse(can_repair_selection(result))
        state,verdict=self.fixture();state['strategy']['matters'][0]['source_quote']='A fabricated own-source assertion.'
        result=review_selection(state,lambda *args:(verdict,[]))
        self.assertTrue(result['selection_diagnostic_invalid'])

    def test_repair_receives_both_original_sources_but_can_change_only_target(self):
        state,verdict=self.fixture();review=review_selection(state,lambda *args:(verdict,[]))
        before=copy.deepcopy(state)
        def invoke(s,role,schema,instruction,payload):
            self.assertEqual([m['id'] for m in payload['sources']],['a'])
            self.assertEqual([m['id'] for m in payload['comparison_sources']],['b'])
            self.assertEqual([m['matter_id'] for m in payload['rejected_decisions']],['a'])
            corrected={**state['strategy']['matters'][0],'rationale':'Adds a documented strike-prevention result alongside the existing union litigation.'}
            return {'core_corrections':[corrected],'other_corrections':[],'unresolved':[]},[]
        repaired=repair_selection({**state,**review},invoke)
        self.assertEqual(repaired['strategy']['matters'][1],before['strategy']['matters'][1])
        self.assertEqual(state,before)

    def test_legacy_explicit_reference_recovers_the_same_unique_proof_without_a_recheck(self):
        state,verdict=self.fixture();check=verdict['checks']['M01']
        check.update(evidence_kind='source',comparison_reference=None,
                     explanation='M02 already demonstrates the capability that this decision calls distinct.')
        before=copy.deepcopy(verdict)
        result=review_selection(state,lambda *args:(verdict,[]))
        bound=result['selection_review']['checks']['a']
        self.assertTrue(bound['comparison_reference_recovered'])
        self.assertEqual(bound['evidence_kind_original'],'source')
        self.assertEqual(bound['comparison_matter_id'],'b')
        self.assertEqual(bound['source_quote'],before['checks']['M01']['source_quote'])
        self.assertEqual(bound['decision_quote'],before['checks']['M01']['decision_quote'])
        self.assertFalse(result['selection_review_validated'])
        self.assertTrue(can_repair_selection(result))
        self.assertEqual(verdict,before)

    def test_legacy_comparison_cannot_guess_an_absent_or_ambiguous_peer_address(self):
        for explanation in ['Another matter demonstrates it.','M99 demonstrates it.']:
            state,verdict=self.fixture();verdict['checks']['M01'].update(
                evidence_kind='source',comparison_reference=None,explanation=explanation)
            result=review_selection(state,lambda *args:(verdict,[]))
            self.assertTrue(result['selection_diagnostic_invalid'])
        state,verdict=self.fixture();duplicate={**state['package']['matters'][1],'id':'c'}
        state['package']['matters'].append(duplicate)
        state['strategy']['matters'].append({**state['strategy']['matters'][1],'matter_id':'c'})
        verdict['checks']['M03']=verdict['checks']['M02'].copy()
        verdict['checks']['M01'].update(evidence_kind='source',comparison_reference=None,explanation='M02 demonstrates it.')
        result=review_selection(state,lambda *args:(verdict,[]))
        self.assertTrue(result['selection_diagnostic_invalid'])
