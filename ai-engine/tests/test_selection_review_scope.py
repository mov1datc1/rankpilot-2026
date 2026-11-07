"""Only unchanged source-bound passing checks survive a local correction."""
import copy
import unittest
from pydantic import ValidationError
from core.selection_review import review_selection

SOURCE='The firm coordinated workforce documentation and collective negotiations.'


def fixture():
    matters=[{'id':mid,'client':'Fictional '+mid,'rawNotes':SOURCE} for mid in ('anchor','local','peer')]
    return {'package':{'directory':'Chambers','practice_area':'Labour & Employment','matters':matters},
            'strategy':{'matters':[{'matter_id':m['id'],'disposition':'core',
                'rationale':'Documented negotiations.','legal_understanding':SOURCE,'source_quote':SOURCE} for m in matters],
                'hero_matter_id':'anchor','thesis':'Collective employment work.','pending_questions':[]}}


def review(state, failed=(), dependent=False, seen=None):
    def invoke(state,role,schema,instruction,payload):
        if seen is not None:seen.append(payload['review_targets'])
        checks={ref:{'status':'repair_required' if ref in failed else 'supported',
            'explanation':'Source-backed interpretation.','source_quote':SOURCE if ref in failed else '',
            'decision_quote':'core' if ref in failed else '',
            'review_dependencies':['M02'] if dependent and ref=='M03' else []} for ref in payload['review_targets']}
        return {'checks':checks},[{'role':'selection_reviewer','usage':{'total_tokens':10}}]
    return review_selection(state,invoke)


class SelectionReviewScopeTests(unittest.TestCase):
    def test_repair_rechecks_only_changed_failed_decision_and_keeps_prior_passes(self):
        state=fixture();first=review(state,failed=['M02']);state.update(first)
        state['strategy']['matters'][1]['disposition']='reserve';seen=[]
        result=review(state,seen=seen)
        self.assertEqual(seen,[['M02']]);self.assertTrue(result['selection_review_validated'])
        self.assertEqual(set(result['selection_review_reused_ids']),{'anchor','peer'})
        self.assertEqual(len(result['selection_review']['checks']),3)
        self.assertEqual(result['selection_review_attempts'],2)

    def test_unchanged_check_cannot_receive_new_out_of_scope_findings(self):
        state=fixture();state.update(review(state,failed=['M02']))
        def invoke(state,role,schema,instruction,payload):
            self.assertEqual(payload['review_targets'],['M02'])
            return {'checks':{ref:{'status':'supported','explanation':'Supported','source_quote':''}
                              for ref in ('M01','M02')}},[]
        with self.assertRaises(ValidationError):review_selection(state,invoke)

    def test_changed_own_source_invalidates_only_its_proof(self):
        state=fixture();state.update(review(state));state['package']['matters'][2]['rawNotes']+=' Relief remains pending.'
        seen=[];review(state,seen=seen);self.assertEqual(seen,[['M03']])

    def test_changed_dependency_reopens_comparative_check(self):
        state=fixture();state.update(review(state,failed=['M02'],dependent=True))
        state['strategy']['matters'][1]['disposition']='reserve';seen=[]
        result=review(state,seen=seen)
        self.assertEqual(seen,[['M02','M03']]);self.assertEqual(result['selection_review_reused_ids'],['anchor'])

    def test_undeclared_comparative_check_conservatively_reopens(self):
        state=fixture();state['strategy']['matters'][2]['rationale']='Distinct contribution compared with selected work.'
        state.update(review(state,failed=['M02']))
        state['strategy']['matters'][1]['disposition']='reserve';seen=[]
        review(state,seen=seen);self.assertEqual(seen,[['M02','M03']])

    def test_scope_or_privacy_change_invalidates_every_proof(self):
        for field,value in [('practice_area','Tax'),('delivery_policy','changed')]:
            state=fixture();state.update(review(state));state['package'][field]=value;seen=[]
            review(state,seen=seen);self.assertEqual(seen,[['M01','M02','M03']])

    def test_no_unchanged_review_buys_another_model_call_or_review_allowance(self):
        state=fixture();state.update(review(state));before=copy.deepcopy(state)
        result=review_selection(state,lambda *args:(_ for _ in ()).throw(AssertionError('Unexpected model call')))
        self.assertTrue(result['selection_review_validated']);self.assertEqual(result['trace'],state['trace'])
        self.assertNotIn('selection_review_attempts',result);self.assertEqual(state,before)

    def test_legacy_diagnostics_without_proofs_are_not_implicitly_cached(self):
        state=fixture();state['selection_review']={'checks':{'anchor':{'status':'supported'}}};seen=[]
        review(state,seen=seen);self.assertEqual(seen,[['M01','M02','M03']])

    def test_optional_followup_is_preserved_as_source_bound_advisory(self):
        state=fixture()
        def invoke(state,role,schema,instruction,payload):
            return {'checks':{ref:{'status':'advisory' if ref=='M02' else 'supported',
                'explanation':'Clarify an optional reported figure without treating it as exposure.',
                'source_quote':SOURCE if ref=='M02' else ''} for ref in payload['review_targets']}},[]
        result=review_selection(state,invoke)
        self.assertTrue(result['selection_review_validated']);self.assertEqual(result['errors'],[])
        self.assertEqual(result['selection_advisories'][0]['matter_id'],'local')
        state.update(result);seen=[]
        review_selection(state,lambda *args:seen.append(args))
        self.assertEqual(seen,[])

    def test_unbound_advisory_is_never_carried_as_source_evidence(self):
        state=fixture()
        def invoke(state,role,schema,instruction,payload):
            return {'checks':{ref:{'status':'advisory','explanation':'Optional follow-up',
                                  'source_quote':'Invented source'} for ref in payload['review_targets']}},[]
        result=review_selection(state,invoke)
        self.assertEqual(result['selection_advisories'],[]);self.assertEqual(result['selection_review_proofs'],{})

