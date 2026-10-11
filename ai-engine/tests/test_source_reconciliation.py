import unittest
from unittest.mock import patch
from utils.source_reconciliation import (Span, Fact, MatterRead, UnitRead, SourceRead, MATTER_FIELDS, ADMIN_FIELDS,
    apply_unit, plan_units, reconcile_source, ReconciliationError, cached_read, _CACHE, _INFLIGHT)


def facts(fields, values=None):
    values = values or {}
    return [Fact(field=f, status='found' if f in values else 'absent', evidence=[Span(**values[f])] if f in values else []) for f in fields]


def fixture():
    text='Matter one\nClient: North Solar\nAdvised on a permit appeal.\nThe authority reversed its decision.\nUSD 10 million\nAna River\n'
    matter={'id':'m1','source_excerpt':text,'rawNotes':'Advised on a permit appeal.','client':'Wrong Cell','confidentialityStatus':'confidential'}
    unit={'id':'u1','text':text,'existing':[matter]}
    review=UnitRead(unit_id='u1',matters=[MatterRead(existing_id='m1',start=1,end=6,
        fields=facts(MATTER_FIELDS,{'client':{'start':2,'end':2,'text':'North Solar'},'rawNotes':{'start':3,'end':4},'value':{'start':5,'end':5},'leadPartner':{'start':6,'end':6}}),
        permission='confirmation_required')],filing=[],administration=facts(ADMIN_FIELDS),lawyers=[])
    return unit, review

class SourceReconciliationTests(unittest.TestCase):
    def test_corrects_wrong_cell_and_recovers_entire_narrative_with_evidence(self):
        unit,review=fixture();m=apply_unit(unit,review)['matters'][0]
        self.assertEqual(m['client'],'North Solar')
        self.assertEqual(m['rawNotes'],'Advised on a permit appeal.\nThe authority reversed its decision.')
        self.assertEqual(m['original_code_extraction']['client'],'Wrong Cell')
        self.assertEqual(m['confidentialityStatus'],'confidential')
        self.assertEqual(m['extraction_issues'],[])

    def test_rejects_invented_value_and_cross_record_evidence(self):
        unit,review=fixture();review.matters[0].fields[0].evidence[0].text='Invented Client'
        with self.assertRaisesRegex(ValueError,'Nonliteral'):apply_unit(unit,review)
        unit,review=fixture();review.matters[0].end=4
        with self.assertRaisesRegex(ValueError,'outside'):apply_unit(unit,review)

    def test_complete_field_and_matter_inventory_required(self):
        unit,review=fixture();review.matters[0].fields.pop()
        with self.assertRaisesRegex(ValueError,'coverage'):apply_unit(unit,review)
        unit,review=fixture();review.empty_ids=['m1'];review.matters=[]
        with self.assertRaisesRegex(ValueError,'Substantive'):apply_unit(unit,review)
        unit,review=fixture();review.matters=[]
        with self.assertRaisesRegex(ValueError,'inventory'):apply_unit(unit,review)

    def test_new_unstructured_matter_is_recovered_without_invented_public_permission(self):
        unit,review=fixture();unit['existing']=[];review.matters[0].existing_id=''
        review.matters[0].permission='publishable'
        m=apply_unit(unit,review)['matters'][0]
        self.assertEqual(m['confidentialityStatus'],'confirmation_required')
        self.assertTrue(m['id'].startswith('u1-new'))

    def test_actual_conflict_retains_both_alternatives(self):
        unit,review=fixture();unit['text']+='EUR 9 million\n';review.matters[0].end=7
        value=next(f for f in review.matters[0].fields if f.field=='value')
        value.status='conflicting';value.evidence=[Span(start=5,end=5),Span(start=7,end=7)]
        m=apply_unit(unit,review)['matters'][0]
        self.assertEqual(m['value'],'');self.assertEqual(m['extraction_issues'][0]['alternatives'],['USD 10 million','EUR 9 million'])

    def test_every_character_including_prefix_and_trailer_is_planned_once(self):
        text='Admin\nMatter 1\nAAA\nBetween\nMatter 2\nBBB\nFooter'
        matters=[{'id':'a','source_excerpt':'AAA','source_heading':'Matter 1'}, {'id':'b','source_excerpt':'BBB','source_heading':'Matter 2'}]
        units=plan_units(text,matters)
        self.assertEqual(''.join(u['text'] for u in units),text)
        self.assertEqual(len(units),3)
        self.assertIn('Footer',units[-1]['text'])

    def test_duplicate_unit_or_missing_unit_is_not_success_and_retains_usage(self):
        unit,review=fixture();review.unit_id='source-1'
        with patch('utils.source_reconciliation.review_batch',return_value=(SourceRead(units=[review,review]),{'total_tokens':123})), self.assertRaises(ReconciliationError) as caught:
            reconcile_source(unit['text'],unit['existing'],{'filing_details':{}})
        self.assertEqual(caught.exception.usage['total_tokens'],123)

    def test_paid_response_reused_without_recounting_usage(self):
        _CACHE.clear();_INFLIGHT.clear();calls=[]
        def invoke():calls.append(1);return {'result':'literal'}, {'total_tokens':77}
        first=cached_read('synthetic-key',invoke);second=cached_read('synthetic-key',invoke)
        self.assertEqual(len(calls),1);self.assertEqual(first[1]['total_tokens'],77)
        self.assertEqual(second[1]['total_tokens'],0);self.assertTrue(second[1]['reused'])
        _CACHE.clear()

    def test_endpoint_full_mode_does_not_pay_for_old_fallback_or_admin_only_read(self):
        import asyncio,json
        from main import _extract_readable_source
        from utils.filing_extraction import extract_filing_fields
        unit,review=fixture();result=apply_unit(unit,review)
        output={**extract_filing_fields(unit['text']),**result,'source_reconciliation':{'status':'reviewed'}}
        with patch('utils.source_reconciliation.reconcile_source',return_value=output),patch('agents.nodes.extraction_node') as old,patch('utils.filing_reconciliation.reconcile_filing') as admin:
            response=asyncio.run(_extract_readable_source(unit['text'],{'reconcile_source':True}))
        self.assertEqual(response.status_code,200,json.loads(response.body));old.assert_not_called();admin.assert_not_called()

    def test_department_mentions_inside_a_matter_do_not_create_false_header_conflicts(self):
        unit,review=fixture()
        review.administration=facts(ADMIN_FIELDS,{'firm_name':{'start':2,'end':2,'text':'North Solar'}})
        review.filing=[{'field':'departmentName','text_value':'North Solar','source_quote':'Client: North Solar'}]
        review=UnitRead.model_validate(review.model_dump())
        result=apply_unit(unit,review)
        self.assertEqual(result['administration']['firm_name'],'')
        self.assertEqual(result['findings'],[])

    def test_nonpartner_count_is_not_silently_promoted_to_qualified_lawyers(self):
        from utils.filing_extraction import extract_filing_fields, resolve_filing_fields
        text='Non-partners who spend at least 50% of their time in this department | 23'
        unit={'id':'admin','text':text,'existing':[]}
        read=UnitRead(unit_id='admin',matters=[],lawyers=[],administration=facts(ADMIN_FIELDS),filing=[{'field':'numLawyers','number_value':23,'source_quote':text}])
        result=apply_unit(unit,read)
        self.assertEqual(result['findings'],[]);self.assertEqual(len(result['filing_uncertainties']),1)
        merged=resolve_filing_fields([{'filing_evidence':{'numLawyers':[{'value':None,'quote':text}]}}])
        self.assertEqual(merged['filing_field_status']['numLawyers'],'not_found')
        self.assertNotIn('numLawyers',merged['filing_details'])

    def test_permission_cannot_be_borrowed_from_a_different_record(self):
        unit,review=fixture();unit['text']+='Publishable matter 2\n'
        review.matters[0].permission='publishable';review.matters[0].permission_evidence=[Span(start=7,end=7)]
        with self.assertRaisesRegex(ValueError,'outside'):apply_unit(unit,review)

    def test_roster_table_evidence_is_not_displayed_as_a_role_or_ranking(self):
        from utils.source_reconciliation import reconcile_lawyers
        table='Partner Y/N Ranked Y/N '+('Source roster row. '*20)
        profile={'name':'Lucía Robles','role':table,'current_ranking':table,'extraction_issues':[],'extraction_evidence':{'role':{'quotes':[table]}}}
        result=reconcile_lawyers([profile],[{'name':'Lucia Robles','is_partner':False,'is_ranked':False}])[0]
        self.assertEqual(result['role'],'Associate');self.assertEqual(result['currentRank'],'Not ranked')
        self.assertEqual(result['extraction_evidence']['role']['quotes'],[table])

    def test_explicit_profile_role_can_correct_the_code_and_missing_rank_stays_unknown(self):
        from utils.source_reconciliation import reconcile_lawyers
        profile={'name':'Lucia Robles','role':'Associate: leading associate','current_ranking':'','extraction_issues':[],'extraction_evidence':{}}
        result=reconcile_lawyers([profile],[{'name':'Lucia Robles','is_partner':True}])[0]
        self.assertFalse(result['isPartner']);self.assertIsNone(result['currentRank'])
