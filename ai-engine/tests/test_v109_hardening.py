"""v1.0.109: independent audit hardening. No client or lawyer names drive behaviour."""
import copy
import unittest
from unittest.mock import patch
from core.candidate_evidence import table_categories, valid_band_label, CHAMBERS_CATEGORY_GUIDANCE
from core.editorial_construction import reconcile_categories, MATTER_TASK
from core.audit_decisions import _current_position
from core.client_identity import clean_name
from core.shared_rules import share_repeated_rules
from core.field_review import reviewed

LABOUR={'directory':'Chambers & Partners','practice_area':'Labour & Employment','jurisdiction':'Latin America — Mexico'}


class CategoriesComeFromTheRealTable(unittest.TestCase):
    def test_individual_categories_of_the_cached_table(self):
        table=table_categories(LABOUR)
        self.assertIn('Band 4',table);self.assertIn('Up and Coming',table);self.assertIn('Senior Statespeople',table)
        self.assertNotIn('Band 5',table)  # Band 5 exists for firms, not for individuals, in this table
        self.assertIsNone(table_categories({**LABOUR,'practice_area':'A Practice With No Cached Table'}))
        self.assertIsNone(table_categories({**LABOUR,'directory':'Legal 500'}))

    def test_a_band_the_table_does_not_use_becomes_its_lowest_individual_band(self):
        table=table_categories(LABOUR)
        self.assertEqual(valid_band_label('Band 5 candidate',table),'Band 4 candidate')
        for kept in ('Band 3 candidate','Up and Coming','Category pending'):
            self.assertEqual(valid_band_label(kept,table),kept)
        self.assertEqual(valid_band_label('Band 5 candidate',None),'Band 5 candidate')
        plan=reconcile_categories({'candidates':[{'suggested_ranking':'Band 5 candidate','category_rationale':'Band 5 as an editorial target.'},
                                                 {'suggested_ranking':'Up and Coming','category_rationale':'Developing reputation.'}]},LABOUR)
        self.assertEqual([c['suggested_ranking'] for c in plan['candidates']],['Band 4 candidate','Up and Coming'])
        self.assertEqual(plan['candidates'][0]['category_rationale'],'Band 4 as an editorial target.')

    def test_guidance_names_no_fixed_band_and_prompts_carry_no_internal_history(self):
        guidance=CHAMBERS_CATEGORY_GUIDANCE['guidance']
        self.assertNotIn('Band 5',guidance);self.assertIn('table_categories',guidance);self.assertIn('Entry-band candidate',guidance)
        for text in (guidance,MATTER_TASK):
            self.assertNotRegex(text,r'v1\.0\.\d+|Ángela|\d{1,2} Nov')


class SpanishAuditAndCleanNames(unittest.TestCase):
    def test_an_english_no_ranking_sentence_is_printed_in_spanish(self):
        spanish=_current_position('No current individual ranking is verified in the supplied research.')
        self.assertTrue(spanish.startswith('sin ranking declarado'))
        # v1.0.127: «Not ranked» is the firm's declaration, stated as such.
        self.assertTrue(_current_position('Not ranked').startswith('la firma lo declara sin ranking'))
        kept='No se verificó una coincidencia exacta de persona y firma en la tabla consultada'
        self.assertEqual(_current_position(kept+'.'),kept)
        self.assertEqual(_current_position('Band 3'),'Band 3')

    def test_a_form_label_is_not_part_of_a_client_name(self):
        self.assertEqual(clean_name('Client: Example Motors'),'Example Motors')
        self.assertEqual(clean_name('Cliente:  Example Motors, S.A. de C.V.'),'Example Motors, S.A. de C.V.')
        self.assertEqual(clean_name('Client Services Group'),'Client Services Group')


class SwitchesAndTrace(unittest.TestCase):
    RULE='Independently compare this narrative against its ORIGINAL source and preserve every decisive fact.'

    def test_shared_rules_can_be_switched_off_without_a_release(self):
        obligations=[{'id':f'o{i}','instruction':f'Matter {i}. '+self.RULE} for i in range(3)]
        self.assertTrue(share_repeated_rules(obligations)[1])
        with patch.dict('os.environ',{'RANKPILOT_SHARED_RULES':'off'}):
            shared,rules=share_repeated_rules(obligations)
        self.assertEqual(rules,{});self.assertEqual(shared,obligations)

    def test_judge_receipts_switch_and_cross_field_binding(self):
        from core.judge_receipts import issue, reusable
        from core.editorial_case import obligations, execution_output
        from test_editorial_case import fixture
        p,s,v=fixture();letter={'leadership':'Sofia led the negotiations.','evidence_gaps':'Routine advice adds no distinct capability.'}
        checks=[{'obligation_id':o['id'],'status':'met','artifact_quote':execution_output(p,v,letter,o['field'])[0],'source_quote':'prevented a strike','reason':'ok'} for o in obligations(p,s,v)]
        with patch.dict('os.environ',{'AI_ENGINE_SERVICE_TOKEN':'secret'}):
            receipts=issue(p,s,v,letter,checks)
            self.assertTrue(receipts)
            # A repair of ANY generated text re-opens every Audit-side verdict.
            changed=copy.deepcopy(v);changed['b10']=changed['b10']+' A new sentence.'
            reused=set(reusable(p,s,changed,letter,receipts))
            audit_side={o['id'] for o in obligations(p,s,changed) if o['field'] in ('leadership','evidence_gaps','executive_assessment')}
            self.assertTrue(audit_side);self.assertFalse(audit_side & reused)
            with patch.dict('os.environ',{'RANKPILOT_JUDGE_RECEIPTS':'off'}):
                self.assertEqual(reusable(p,s,v,letter,receipts),[]);self.assertEqual(issue(p,s,v,letter,checks),[])

    def test_review_trace_names_the_fields_without_content(self):
        entry=reviewed([{'field':'b10','hash':'a'*64,'output':'Confidential prose.','obligations':[{'id':'argument:0:b10'}]}])
        self.assertEqual(entry['reviewed_fields'][0]['field'],'b10');self.assertEqual(len(entry['reviewed_fields'][0]['hash']),12)
        self.assertNotIn('Confidential',str(entry))


if __name__=='__main__':unittest.main()
