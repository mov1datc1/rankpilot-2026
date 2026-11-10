"""Offline regressions for information loss at the actual repair boundary."""
import copy
import unittest
from unittest.mock import patch
from test_editorial_development import PACKAGE, STRATEGY, DEV
from core.editorial_repair import repair_rejected_development, repair_development


class RepairHandoffRetrospectiveTests(unittest.TestCase):
    def test_locator_merges_distinct_findings_for_one_field(self):
        defects=[{'severity':'critical','owner':'rankpilot','scope':'submission',
                  'code':'EDITORIAL_OMISSION','message':message}
                 for message in ('Restore source workforce scale.', 'Restore the attributed firm action.')]
        plan={'locations':[{'path':'matters/0/text','defect_index':i,'reason':reason}
                           for i,reason in enumerate(('Add workforce detail.', 'Restore firm actor.'))],
              'unresolved':[]}
        with patch('core.review_graph.invoke_role',return_value=(plan,[])), \
             patch('core.editorial_repair.repair_development',return_value={}) as repair:
            repair_rejected_development({'package':PACKAGE,'strategy':STRATEGY},DEV,defects)
        target=repair.call_args.args[2]['matters/0/text']
        for text in [d['message'] for d in defects]+[p['reason'] for p in plan['locations']]:
            self.assertIn(text,target['problem'])

    def test_locator_keeps_direct_target_postconditions_and_instruction(self):
        direct={'severity':'critical','owner':'rankpilot','scope':'submission',
                'code':'UNSUPPORTED_CLAIM','field_path':'matters/0/text',
                'artifact_quote':DEV['matters'][0]['text'],'message':'Withdraw this unsupported assertion.'}
        located={'severity':'critical','owner':'rankpilot','scope':'submission',
                 'code':'EDITORIAL_OMISSION','message':'Restore the original legal mechanism.'}
        plan={'locations':[{'path':'matters/0/text','defect_index':0,'reason':'The legal mechanism belongs here.'}], 'unresolved':[]}
        with patch('core.review_graph.invoke_role',return_value=(plan,[])), \
             patch('core.editorial_repair.repair_development',return_value={}) as repair:
            repair_rejected_development({'package':PACKAGE,'strategy':STRATEGY},DEV,[direct,located])
        target=repair.call_args.args[2]['matters/0/text']
        self.assertEqual(target.get('rejected_quotes'),[direct['artifact_quote']])
        self.assertIn(direct['message'],target['problem'])
        self.assertIn(located['message'],target['problem'])

    def test_comparison_child_keeps_reserve_source_but_b10_stays_core(self):
        package=copy.deepcopy(PACKAGE);strategy=copy.deepcopy(STRATEGY)
        package['matters'].extend([{'id':'reserve','source_excerpt':'Distinct reserve outcome.'},
                                   {'id':'excluded','source_excerpt':'Off-practice work.'}])
        strategy['matters'].extend([{'matter_id':'reserve','disposition':'reserve'},
                                    {'matter_id':'excluded','disposition':'excluded'}])
        targets={p:{'current_value':'Current comparison','problem':'Compare both sources.',
                    'source_evidence':{'package':package,'strategy':strategy}}
                 for p in ('comparisons/0/tradeoff','b10')}
        before=copy.deepcopy(targets)
        with patch('core.review_graph.invoke_role',return_value=({'corrections':[], 'unresolved':['Offline fixture']},[])) as model:
            repair_development({'package':package,'strategy':strategy},DEV,targets)
        payload=model.call_args_list[0].args[4]
        def ids(path):
            evidence=payload['repair_targets'][path]['source_evidence']
            if 'reference' in evidence:evidence=payload[evidence['reference']]
            return {m['id'] for m in evidence['package']['matters']}
        self.assertEqual(ids('comparisons/0/tradeoff'),{'m1','m2','reserve'})
        self.assertEqual(ids('b10'),{'m1'})
        self.assertEqual(targets,before)
