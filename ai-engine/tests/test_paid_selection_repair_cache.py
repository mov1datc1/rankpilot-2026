import copy,json,unittest
from unittest.mock import patch
from core.selection_repair_cache import apply_paid_selection_repair,replay_selection_repair,LEGACY_QUOTE_ERROR,LEGACY_REPAIR_REVISION
from core.selection_review import repair_selection
from test_selection_decision_corrections import fixture,SOURCE

def cached_fixture():
    s=fixture();s['package']['matters'].append({**s['package']['matters'][1],'id':'plain'})
    s['strategy']['matters'].append({**s['strategy']['matters'][1],'matter_id':'plain'})
    s['selection_feedback'].update(field_only=False)
    s['selection_feedback']['failed_checks']['plain']={**s['selection_feedback']['failed_checks']['local'],'correction_dispositions':[]}
    s.update(selection_repair_replay_only=True,selection_repair_attempts=2,selection_review_attempts=2,
        errors=[LEGACY_QUOTE_ERROR],selection_diagnostic_invalid=False,
        trace=[{'role':'strategist','provider_request_id':'resp_test123','prompt_revision':LEGACY_REPAIR_REVISION,'usage':{'total_tokens':10}}])
    ds={d['matter_id']:d for d in s['strategy']['matters']}
    value={'core_corrections':[{**ds['plain'],'source_quote':'The represented side is not stated.'}],
        'other_corrections':[{**ds['local'],'disposition':'reserve'}],'unresolved':[]}
    raw={'id':'resp_test123','status':'completed','usage':{'total_tokens':10},'output':[{'content':[{'type':'output_text','text':json.dumps(value)}]}]}
    return s,raw

class PaidSelectionRepairCacheTests(unittest.TestCase):
    def test_same_source_citation_can_change_without_changing_original_source(self):
        s,raw=cached_fixture();before=copy.deepcopy(s);result=apply_paid_selection_repair(s,raw)
        self.assertEqual(result['selection_repair_attempts'],2)
        self.assertEqual(result['trace'],s['trace']);self.assertFalse(result['selection_repair_replay_only'])
        self.assertEqual(result['selection_repair_replay_report']['new_generation_calls'],0)
        self.assertEqual(s,before)
        self.assertEqual(next(d for d in result['strategy']['matters'] if d['matter_id']=='plain')['source_quote'],'The represented side is not stated.')
        self.assertEqual(result['strategy']['matters'][0],s['strategy']['matters'][0])

    def test_new_repair_accepts_own_literal_citation_and_counts_only_one_attempt(self):
        s,raw=cached_fixture();s['selection_repair_attempts']=1
        value=json.loads(raw['output'][0]['content'][0]['text'])
        result=repair_selection(s,lambda current,role,schema,instruction,payload:(value,current['trace']))
        self.assertEqual(result['selection_repair_attempts'],2)
        self.assertEqual(result['errors'],[])
        self.assertEqual(s['package']['matters'][2]['rawNotes'],SOURCE)

    def test_foreign_citation_is_still_rejected(self):
        s,raw=cached_fixture();v=json.loads(raw['output'][0]['content'][0]['text']);v['core_corrections'][0]['source_quote']='A different client won an unrelated dispute.'
        raw['output'][0]['content'][0]['text']=json.dumps(v)
        with self.assertRaisesRegex(ValueError,'remains invalid'):apply_paid_selection_repair(s,raw)

    def test_wrong_identity_usage_incomplete_or_exhausted_review_never_replays(self):
        s,raw=cached_fixture()
        for delta in ({'id':'resp_foreign'},{'status':'incomplete'},{'usage':{'total_tokens':11}},{'incomplete_details':{'reason':'max_output_tokens'}}):
            with self.assertRaises(ValueError):apply_paid_selection_repair(s,{**raw,**delta})
        for delta in ({'selection_review_attempts':3},{'selection_repair_attempts':1},{'selection_repair_replay_only':False},{'errors':['A different failure']},{'trace':[]}):
            with self.assertRaises(ValueError):apply_paid_selection_repair({**s,**delta},raw)

    def test_retrieval_failure_has_no_generation_fallback(self):
        s,_=cached_fixture()
        with patch('openai.OpenAI') as client,patch('utils.model_factory.get_model_settings',return_value={'openai_api_key':'unit'}),patch('core.review_graph.invoke_role') as invoke:
            client.return_value.responses.retrieve.side_effect=RuntimeError('Retrieval unavailable')
            with self.assertRaises(RuntimeError):replay_selection_repair(s)
            client.assert_called_once_with(api_key='unit',max_retries=0,timeout=30)
            client.return_value.responses.retrieve.assert_called_once_with('resp_test123');invoke.assert_not_called()

    def test_graph_reuses_paid_repair_then_runs_only_the_remaining_independent_review(self):
        from core.review_graph import create_review_graph
        s,raw=cached_fixture();s['selection_failure_history']=[['local','plain'],['local','plain']]
        calls=[]
        def review(state,role,schema,instruction,payload):
            calls.append(role)
            self.assertEqual(role,'selection_reviewer')
            return {'checks':{ref:{'status':'supported','explanation':'Source and repaired decision agree.','source_quote':''} for ref in payload['review_targets']}},state['trace']
        with patch('core.selection_repair_cache.replay_selection_repair',side_effect=lambda state:apply_paid_selection_repair(state,raw)),patch('core.review_graph.invoke_role',side_effect=review):
            out=create_review_graph().invoke({**s,'operation':'strategy'})
        self.assertTrue(out['selection_review_validated']);self.assertEqual(out['selection_review_attempts'],3)
        self.assertEqual(out['selection_repair_attempts'],2);self.assertEqual(calls,['selection_reviewer'])
