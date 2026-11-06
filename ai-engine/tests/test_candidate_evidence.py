import copy
import unittest
from core.candidate_evidence import profile_units, profile_errors, category_error, bind_public_quote
from core.editorial_case import obligations, execution_verdict_contract, execution_defects, execution_output
from core.editorial_development import development_errors, DEVELOPMENT_VERSION, development_contract
from core.editorial_repair import repair_targets, apply_corrections
from test_editorial_case import fixture
from core.review_graph import Verdict
from openai.lib._pydantic import to_strict_json_schema

BIO='Before joining the firm, Sofia served as Legal Director for three countries at Example Staffing. She is Vice President of the Labour Commission at Example Federation. Her work connects governance and disputes.'
PUBLIC='Sofia previously served as Legal Director for three countries at Example Staffing and is Vice President of the Labour Commission at Example Federation.'

def candidate_case():
    p,s,v=fixture();v['version']=DEVELOPMENT_VERSION
    p['lawyers'][0]['bio']=BIO
    c=v['candidates'][0];c.update(submission_bio=PUBLIC,suggested_ranking='Band 5 candidate',category_missing_criterion='')
    c['profile_coverage']=[{'reference':u['reference'],'decision':'retain' if i<2 else 'omit','source_quote':u['source_quote'],'public_quote':PUBLIC if i<2 else '', 'reason':'Retains the material office and scope.' if i<2 else 'General commentary already demonstrated by the matters.'} for i,u in enumerate(profile_units(p['lawyers'][0]))]
    return p,s,v

class CandidateEvidenceTests(unittest.TestCase):
    def test_binding_does_not_promote_or_rewrite_a_department_heads_bio(self):
        from core.editorial_development import bind_development
        p,s,v=candidate_case();p['filing_details']={'heads':[{'name':'Sofia Vega'}]}
        v['candidates'][0]['submission_bio']='Sofia Vega is a partner in the employment practice. '+PUBLIC
        original=copy.deepcopy(v)
        bound=bind_development(p,v)
        self.assertEqual(bound['candidates'][0]['submission_bio'],original['candidates'][0]['submission_bio'])
        self.assertNotIn('Partner and Head',bound['candidates'][0]['submission_bio'])
        self.assertEqual(v,original)

    def test_joined_profile_clauses_bind_only_the_actual_unchanged_words(self):
        bio='His work connects legal strategy with regional implementation, and he provides coordination within the national approach.'
        for quote,expected in [('His work connects legal strategy with regional implementation.','His work connects legal strategy with regional implementation'),('He provides coordination within the national approach.','he provides coordination within the national approach')]:
            self.assertEqual(bind_public_quote(quote,bio),expected)
        for quote in ['He leads coordination within the national approach.','He provides coordination across four countries.','He provides coordination.','']:
            self.assertEqual(bind_public_quote(quote,bio),quote)
        repeated='he provides coordination within the national approach, and he provides coordination within the national approach.'
        quote='He provides coordination within the national approach.'
        self.assertEqual(bind_public_quote(quote,repeated),quote)

    def test_confirmed_headship_is_reviewed_against_its_source_instead_of_inserted(self):
        p,s,v=candidate_case();head={'name':'Sofia Vega','email':'sofia@example.test'}
        p['filing_details']={'heads':[head]}
        obligation=next(o for o in obligations(p,s,v) if o['id']=='head:0:b9')
        self.assertEqual(obligation['sources'],[{'name':'Sofia Vega','confirmed_department_head':head}])
        self.assertEqual(obligation['field'],'candidates/0/submission_bio')
        self.assertIn('does not by itself establish partner',obligation['instruction'])

    def test_source_profile_register_deduplicates_fields_and_excludes_contacts(self):
        person={'name':'Sofia Vega','bio':'Sofia Vega | sofia@example.test | 2022 | '+BIO,'comments':BIO,'standout_work':'Sofia served as Legal Director for three countries at Example Staffing.'}
        units=profile_units(person)
        self.assertEqual(len(units),3)
        self.assertFalse(any('@' in u['source_quote'] for u in units))
        self.assertEqual([u['reference'] for u in units],['P01','P02','P03'])
    def test_professional_office_and_career_survive_alongside_matter_work(self):
        p,s,v=candidate_case();self.assertEqual(development_errors(p,s,v),[])
        v['candidates'][0]['submission_bio']='Sofia leads negotiations and prevented a strike.'
        self.assertTrue(any('Perfil B9' in e for e in development_errors(p,s,v)))
    def test_material_role_cannot_be_silently_omitted(self):
        p,s,v=candidate_case();item=v['candidates'][0]['profile_coverage'][1]
        item.update(decision='omit',public_quote='',reason='Prefer recent matters.')
        self.assertTrue(any('material' in e for e in profile_errors(p['lawyers'][0],v['candidates'][0])))
    def test_privacy_can_generalize_identity_without_losing_career_role(self):
        p,s,v=candidate_case();c=v['candidates'][0];c['submission_bio']='Sofia served as Legal Director for three countries at a staffing business and is Vice President of a professional labour commission.'
        for item in c['profile_coverage'][:2]:item.update(decision='generalize',public_quote=c['submission_bio'])
        self.assertEqual(profile_errors(p['lawyers'][0],c),[])
    def test_missing_duplicate_and_other_person_quotes_do_not_pass(self):
        p,s,v=candidate_case();c=v['candidates'][0]
        for transform in (lambda a:a[:-1],lambda a:a+[a[0]],lambda a:[{**x,'source_quote':'Another person was a director elsewhere.'} for x in a]):
            bad={**c,'profile_coverage':transform(copy.deepcopy(c['profile_coverage']))}
            self.assertTrue(profile_errors(p['lawyers'][0],bad))
    def test_invalid_profile_routes_to_only_its_candidate_repair(self):
        p,s,v=candidate_case();v['candidates'][0]['profile_coverage']=[]
        targets=repair_targets(p,s,v);self.assertIn('candidates/0',targets)
        self.assertEqual(targets['candidates/0']['source_evidence']['person']['bio'],BIO)
        self.assertFalse(any(k.startswith('matters/') for k in targets))
        corrected=candidate_case()[2]['candidates'][0]
        fixed=apply_corrections(v,{'candidates/0':targets['candidates/0']},{'corrections':[{'path':'candidates/0','value':corrected,'reason':'Restore the source profile evidence.'}]})
        self.assertEqual(development_errors(p,s,fixed),[])
        self.assertEqual(v['matters'],fixed['matters'])
    def test_text_only_voice_repair_receives_unchanged_credential_bindings(self):
        p,s,v=candidate_case();v['candidates'][0]['submission_bio']+=' The supplied biography identifies the legal work.'
        target=repair_targets(p,s,v)['candidates/0/submission_bio']
        self.assertEqual(target['preserve_profile_quotes'],[PUBLIC,PUBLIC])
        self.assertEqual(target['source_evidence']['person']['bio'],BIO)
        self.assertNotIn('candidates/0',repair_targets(p,s,v))
    def test_category_placeholder_is_rejected_and_pending_is_actionable(self):
        p,s,v=candidate_case();c=v['candidates'][0]
        for label in ('Band ranking candidate','Individual ranking candidate','Potential band candidate','BAND RANKING CANDIDATE'):
            c['suggested_ranking']=label;self.assertTrue(category_error(c))
        c.update(suggested_ranking='Category pending',category_missing_criterion='')
        self.assertTrue(category_error(c))
        c['category_missing_criterion']='Confirm qualification date and comparative maturity to distinguish the proposed individual categories.'
        self.assertIsNone(category_error(c))
        c.update(suggested_ranking='Band 5 candidate',category_missing_criterion='')
        self.assertIsNone(category_error(c))
    def test_schema_requires_profile_coverage_and_pending_criterion(self):
        p,s,v=candidate_case();schema=to_strict_json_schema(development_contract(p,s))
        candidate=next(d for d in schema['$defs'].values() if 'profile_coverage' in d.get('properties',{}))
        self.assertIn('profile_coverage',candidate['required']);self.assertIn('category_missing_criterion',candidate['required'])
    def test_each_original_profile_unit_has_an_independent_exact_b9_obligation(self):
        p,s,v=candidate_case();items=[o for o in obligations(p,s,v) if o['id'].startswith('profile:')]
        self.assertEqual(len(items),3)
        self.assertEqual(items[1]['sources'][0]['source_excerpt'],profile_units(p['lawyers'][0])[1]['source_quote'])
        self.assertTrue(all(o['field']=='candidates/0/submission_bio' for o in items))
    def test_final_proof_uses_rendered_bio_not_old_generated_words(self):
        p,s,v=candidate_case();p['rendered_artifact']='Sofia served as Legal Director at a confidential entity.'
        p['rendered_candidate_bios']={'Sofia Vega':p['rendered_artifact']}
        value,rendered=execution_output(p,v,{},'candidates/0/submission_bio')
        self.assertEqual(value,rendered)
        p['rendered_candidate_bios']={}
        value,_=execution_output(p,v,{},'candidates/0/submission_bio');self.assertEqual(value,'')
    def test_generic_category_and_missing_profile_fail_before_generation_repair(self):
        p,s,v=candidate_case();c=v['candidates'][0];c.update(suggested_ranking='Band ranking candidate',profile_coverage=[])
        errors=development_errors(p,s,v)
        self.assertTrue(any('categoría razonada' in e for e in errors));self.assertTrue(any('Perfil B9' in e for e in errors))

    def test_unpublished_legal500_roster_does_not_require_a_missing_public_profile(self):
        p,s,v=candidate_case();p['directory']='Legal 500';c=v['candidates'][0]
        c['recommendation']='develop';c['suggested_ranking']='Category pending'
        items=obligations(p,s,v)
        self.assertFalse(any(o['id'].startswith('profile:') or o['id']=='candidate:0:b9' for o in items))
        self.assertTrue(any(o['id']=='candidate:0:audit' for o in items))
