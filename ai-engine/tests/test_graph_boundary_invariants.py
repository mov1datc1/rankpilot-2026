"""Cross-node invariants: valid state stays valid and bounded routes terminate."""
import copy
import unittest
from unittest.mock import patch
from contextlib import ExitStack
import core.review_graph as graph
from core.editorial_development import develop,development_errors
from core.editorial_repair import repair_targets,repair_development
from test_editorial_execution import linked_case
from test_review_graph import LETTER


def formatted_case():
    p,s,v=linked_case();c=v['candidates'][0]
    links=c['profile_coverage']+c['submission_case_coverage']
    for quote in {l['public_quote'] for l in links if l['public_quote']}:
        c['submission_bio']=c['submission_bio'].replace(quote,'**'+quote+'**')
    for link in links:
        if link['public_quote']:link['public_quote']='**'+link['public_quote']+'**'
    for field in ('b10','c2'):
        v[field]='**'+v[field]+'**'
        for link in v['institutional_execution']:link[field+'_quote']='**'+link[field+'_quote']+'**'
    v['matters'][0]['text']='**'+v['matters'][0]['text']+'**'
    return p,s,v


class GraphBoundaryInvariantTests(unittest.TestCase):
    def assert_canonical_valid(self,p,s,result):
        self.assertTrue(result['development_validated'],result.get('errors'))
        self.assertEqual(development_errors(p,s,result['development']),[])
        self.assertNotIn('**',result['development']['candidates'][0]['submission_bio'])
        for link in result['development']['institutional_execution']:
            self.assertIn(link['b10_quote'],result['development']['b10'])
            self.assertIn(link['c2_quote'],result['development']['c2'])

    def test_fresh_development_canonicalizes_before_validating_its_output_proofs(self):
        from test_biography_depth import depth_case
        from construction_fixture import answer
        p,s,v=depth_case()
        for field in ('b10','c2'):
            v[field]='**'+v[field]+'**'
            for link in v['institutional_execution']:link[field+'_quote']='**'+link[field+'_quote']+'**'
        before=copy.deepcopy((p,s,v))
        self.assertEqual(development_errors(p,s,v),[])
        def invoke(state,role,schema,instruction,payload):
            return answer(schema,payload,v),state.get('trace',[])+[{'role':role}]
        with patch('core.review_graph.invoke_role',side_effect=invoke) as model:
            result=develop({'package':p,'strategy':s})
        self.assertEqual(model.call_count,4);self.assert_canonical_valid(p,s,result)
        self.assertEqual((p,s,v),before)
        self.assertEqual(result['development']['candidates'][0]['supporting_matters'],v['candidates'][0]['supporting_matters'])
        self.assertEqual([u['source_quote'] for u in result['development']['candidates'][0]['profile_coverage']],
                         [u['source_quote'] for u in v['candidates'][0]['profile_coverage']])

    def test_saved_development_does_not_return_a_valid_flag_with_stale_formatted_quotes(self):
        p,s,v=formatted_case()
        with patch('core.review_graph.invoke_role') as model:
            result=develop({'package':p,'strategy':s,'development':v,'development_reusable':True})
        model.assert_not_called();self.assert_canonical_valid(p,s,result)

    def test_repair_uses_the_same_canonical_output_boundary(self):
        p,s,good=linked_case();bad=copy.deepcopy(good)
        bad['candidates'][0]['profile_coverage'][0]['public_quote']='Absent generated quote.'
        _,_,formatted=formatted_case();c=formatted['candidates'][0]
        delta={'submission_bio':c['submission_bio'],
            'profile_coverage':{u['reference']:{k:u[k] for k in ('decision','public_quote','reason')} for u in c['profile_coverage']},
            'submission_case_coverage':{f'S{i+1:02d}':u['public_quote'] for i,u in enumerate(c['submission_case_coverage'])}}
        answer={'results':{'T01':{'path':'candidates/0','status':'corrected','value':delta,'reason':'Restore the actual BIO proofs.'}},'source_notes':[]}
        with patch('core.review_graph.invoke_role',return_value=(answer,[{'role':'repair','usage':{'total_tokens':5}}])) as model:
            result=repair_development({'package':p,'strategy':s},bad,repair_targets(p,s,bad))
        model.assert_called_once();self.assert_canonical_valid(p,s,result)

    def test_classification_only_writer_recheck_advances_its_existing_attempt_counter(self):
        p,s,v=linked_case();feedback=[{'code':'SELECTION_MISMATCH','scope':'letter','severity':'critical','message':'Check the disposition.'}]
        state={'package':p,'strategy':s,'development':v,'letter':LETTER,'repair_feedback':feedback,'writer_attempts':0}
        with patch('core.portfolio_consistency.verify_portfolio_consistency',return_value=([],[])),patch('core.review_graph.invoke_role') as model:
            result=graph.writer(state)
        model.assert_not_called();self.assertEqual(result['writer_attempts'],1)
        self.assertEqual(result['letter'],LETTER)

    def run_bounded_graph(self,selection_failures):
        p,s,v=linked_case();p['delivery_policy']='restricted-unconfirmed-v1'
        for matter in p['matters']:matter.update(publication_route='E',resolved_publication_status='confirmation_required')
        before=copy.deepcopy((p,s,v));review_calls=[];editor_calls=[]
        letter=copy.deepcopy(LETTER);names={m['id']:m.get('client') or m['id'] for m in p['matters']}
        letter['portfolio']='\n'.join(f"{i+1}. {names[d['matter_id']]}" for i,d in enumerate(x for x in s['matters'] if x['disposition']=='core'))
        defect={'code':'SELECTION_MISMATCH','scope':'letter','severity':'critical','message':'The reviewer still rejects this exact letter.'}
        def review(state):
            review_calls.append(1);ok=len(review_calls)>selection_failures
            return {'selection_validated':ok,'selection_review_validated':ok,'selection_review_attempts':len(review_calls),
                    'errors':[] if ok else ['Selection correction required.']}
        def editor(state):
            editor_calls.append(1)
            return {'judge':{'passed':False,'defects':[defect]},'trace':[]}
        with ExitStack() as stack:
            stack.enter_context(patch('core.review_graph.select_or_reuse',return_value={'strategy':s,'errors':[]}))
            stack.enter_context(patch('core.review_graph.selection_gate',return_value={'selection_validated':True,'errors':[]}))
            stack.enter_context(patch('core.review_graph.selection_review',side_effect=review))
            stack.enter_context(patch('core.selection_review.can_repair_selection',side_effect=lambda state:len(review_calls)<=selection_failures))
            stack.enter_context(patch('core.selection_review.can_recheck_selection_diagnostic',return_value=False))
            stack.enter_context(patch('core.review_graph.develop',return_value={'development':v,'development_validated':True,'errors':[]}))
            stack.enter_context(patch('core.portfolio_consistency.verify_portfolio_consistency',return_value=([],[])))
            stack.enter_context(patch('core.review_graph.editor',side_effect=editor))
            model=stack.enter_context(patch('core.review_graph.invoke_role',return_value=(copy.deepcopy(letter),[])))
            result=graph.create_review_graph().invoke({'package':p,'letter':letter,'repair_feedback':[defect]},
                    {'recursion_limit':getattr(graph,'EDITORIAL_GRAPH_RECURSION_LIMIT',12)})
        # Both classification-only rechecks resolve locally in this fixture;
        # the second judge verdict no longer falls through to full rewriting.
        model.assert_not_called();self.assertEqual((p,s,v),before)
        self.assertEqual(len(review_calls),selection_failures+1);self.assertEqual(len(editor_calls),2)
        self.assertEqual(result['writer_attempts'],2);self.assertFalse(result['release_verdict']['passed'])
        return result

    def test_repeated_classification_rejection_does_not_loop_past_two_writer_attempts(self):
        self.run_bounded_graph(0)

    def test_full_graph_can_reach_release_after_its_existing_bounded_selection_and_writer_retries(self):
        result=self.run_bounded_graph(2)
        self.assertEqual(len(result['node_events']),17)
        self.assertEqual(result['node_events'][-1]['node'],'release')
