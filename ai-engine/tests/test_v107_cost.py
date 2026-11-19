"""v1.0.107: lower review cost without changing what is reviewed."""
import unittest
from unittest.mock import patch
from core.shared_rules import share_repeated_rules, expand
from core.field_review import units_for, project_checks, schedule, review_payload, batches
from core.review_graph import role_payload
from test_field_review import state, verdict

RULE='Independently compare this selected matter narrative against its ORIGINAL source and preserve every decisive fact.'


class SharedRules(unittest.TestCase):
    def test_each_repeated_rule_is_sent_once_and_reads_back_verbatim(self):
        obligations=[{'id':f'o{i}','instruction':f'Check matter {i} for Client {i}. '+RULE} for i in range(3)]
        shared,rules=share_repeated_rules(obligations)
        self.assertEqual(list(rules.values()),[RULE])
        self.assertTrue(all(o['instruction'].endswith('[R1]') for o in shared))
        self.assertEqual([expand(o['instruction'],rules) for o in shared],[o['instruction'] for o in obligations])
        self.assertIn('Client 2',shared[2]['instruction'])  # specifics stay in place
        self.assertEqual(obligations[0]['instruction'],'Check matter 0 for Client 0. '+RULE)  # input untouched
        self.assertEqual(share_repeated_rules([{'instruction':RULE}])[1],{})  # a single use is not shared

    def test_field_review_and_final_judge_payloads_send_rules_once(self):
        current=state();units=units_for(current);byf={u['field']:u for u in units}
        for group in batches(units):
            payload=review_payload([byf[f] for f in group])
            rules=payload.get('shared_rules',{})
            for item in payload['units']:
                for checked in item['obligations']:
                    original=next(o for o in byf[item['field']]['obligations'] if o['id']==checked['id'])
                    self.assertEqual(expand(checked['instruction'],rules),original['instruction'])
        result=role_payload({'case_obligations':[{'id':f'o{i}','field':'b10','instruction':'Field b10. '+RULE,'sources':[{'id':'m1'}]} for i in range(4)]},'editor')
        self.assertEqual(result['shared_rules'],{'R1':RULE})
        self.assertTrue(all(o['instruction']=='Field b10. [R1]' and o['source_references']==[{'matter_id':'m1'}] for o in result['case_obligations']))


class IdenticalUnitIsNeverReviewedTwice(unittest.TestCase):
    def test_a_failed_identical_unit_returns_to_repair_without_a_review_call(self):
        current=state();current.update(schedule(current));units=units_for(current)
        failed=next(u for u in units if u['field'].startswith(('matters/','comparisons/')))
        defects=[{**d,'unit_hash':failed['hash']} for d in project_checks([failed],verdict([failed],failed['field']))[1]]
        rest=[u for u in units if u['field']!=failed['field']]
        current['field_review_receipts']=project_checks(rest,verdict(rest))[0]
        # The failure list was cleared by another route, but the verdict is remembered.
        current['field_review_failures']=[]
        current['field_review_failed_verdicts']=[{'field':failed['field'],'hash':failed['hash'],'defects':defects}]
        with patch('core.review_graph.invoke_role',side_effect=AssertionError('no review call')):
            result=schedule(current)
        self.assertEqual(result['repair_continuation']['phase'],'repair')
        self.assertEqual({d['field_path'] for d in result['field_review_failures']},{failed['field']})

    def test_a_changed_unit_or_a_closed_observation_is_not_reopened(self):
        current=state();current.update(schedule(current));units=units_for(current)
        failed=next(u for u in units if u['field'].startswith(('matters/','comparisons/')))
        defects=[{**d,'unit_hash':failed['hash']} for d in project_checks([failed],verdict([failed],failed['field']))[1]]
        rest=[u for u in units if u['field']!=failed['field']]
        current['field_review_receipts']=project_checks(rest,verdict(rest))[0]
        current['field_review_failed_verdicts']=[{'field':failed['field'],'hash':'an-older-text','defects':defects}]
        result=schedule(current)
        self.assertEqual(result['repair_continuation']['phase'],'review')  # changed text is reviewed normally
        current['field_review_failed_verdicts']=[{'field':failed['field'],'hash':failed['hash'],'defects':defects}]
        current['field_review_observations']=[{'field':failed['field'],'hash':failed['hash'],'reason':'bounded_repair_finished_with_observations','defects':defects}]
        closed=schedule(current)
        self.assertIsNone(closed['repair_continuation'])
        self.assertEqual(closed['field_review_failures'],[])


if __name__=='__main__':unittest.main()


class BiographyWriterReceivesMandateResults(unittest.TestCase):
    """v1.0.108: most B9 failures were an achieved result omitted or rewritten as an aim."""
    def test_bio_payload_carries_the_plan_results_of_this_lawyers_mandates(self):
        import copy as _copy
        from core.editorial_construction import advance, bio_task
        from test_editorial_construction import ConstructionTests
        case=ConstructionTests();st,v=case.fixture();calls=[]
        advance(st,case.provider(v,calls))
        payload=next(p for name,p in calls if name=='OwnedBiography')
        own={m['id'] for m in payload['package']['matters']}
        self.assertTrue(payload['mandate_results'])
        self.assertTrue(set(payload['mandate_results'])<=own)
        self.assertTrue(all(isinstance(q,list) and q for q in payload['mandate_results'].values()))
        self.assertIn('never rewrite an achieved result as an aim',bio_task())


class MatterTenseAndStatusFidelity(unittest.TestCase):
    """v1.0.108: matter failures from invented 'ongoing' status and changed tense (DeForest, Ramos)."""
    def test_matter_writer_keeps_status_and_tense_as_the_source_gives_them(self):
        from core.editorial_construction import MATTER_TASK
        for phrase in ('when the source gives no status,\nstate none','an achieved result stays achieved','stays planned','is not described as carried out'):
            self.assertIn(phrase,MATTER_TASK)
