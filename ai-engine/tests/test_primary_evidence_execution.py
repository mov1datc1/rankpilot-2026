import copy
import unittest
from core.editorial_execution import execution_errors, primary_lead_anchor
from core.editorial_repair import repair_targets, apply_corrections
from test_editorial_execution import linked_case, SECOND

PRIMARY='Sofia Vega led project employment structuring and prevented a threatened strike.'


def anchored_case():
    p,s,v=linked_case();c=v['candidates'][0]
    c['supporting_matters'].append({'matter_id':'m2','personal_role':'Led investigation','source_quote':p['matters'][1]['source_excerpt']})
    c['submission_bio']+=' '+SECOND
    c['submission_case_coverage'].append({'matter_id':'m2','source_quote':p['matters'][1]['source_excerpt'],'public_quote':SECOND})
    p['matters'].insert(0,{'id':'primary','client':'Fictional Infrastructure Employer',
        'leadPartner':'Sofia Vega','source_excerpt':PRIMARY,'publication_route':'E'})
    s['matters'].insert(0,{'matter_id':'primary','disposition':'core','source_quote':PRIMARY,'rationale':'Primary documented work.'})
    s['hero_matter_id']='primary';v['matters'].insert(0,{'matter_id':'primary','text':PRIMARY,'completion_status':'Pending'})
    return p,s,v


class PrimaryEvidenceExecutionTests(unittest.TestCase):
    def test_two_secondary_links_do_not_replace_primary_source(self):
        p,s,v=anchored_case()
        self.assertEqual(primary_lead_anchor(p,s,v['candidates'][0]),'primary')
        self.assertTrue(any('mandato principal' in e for e in execution_errors(p,v,s)))

    def test_team_membership_does_not_override_source_confirmed_lead_priority(self):
        p,s,v=anchored_case();p['matters'][0].update(leadPartner='Luis Prado',teamMembers='Sofia Vega')
        self.assertNotEqual(primary_lead_anchor(p,s,v['candidates'][0]),'primary')

    def test_reserve_is_not_removed_from_personal_support(self):
        p,s,v=anchored_case();s['matters'][0]['disposition']='reserve'
        self.assertNotEqual(primary_lead_anchor(p,s,v['candidates'][0]),'primary')
        self.assertTrue(any(d['matter_id']=='primary' for d in s['matters']))

    def test_source_bound_append_retains_bio_profile_category_and_other_prose(self):
        p,s,v=anchored_case();before=copy.deepcopy((p,s,v));targets={'candidates/0':repair_targets(p,s,v)['candidates/0']}
        target=targets['candidates/0'];self.assertEqual(target['append_personal_anchor'],'primary')
        c=copy.deepcopy(v['candidates'][0]);c['submission_bio']=PRIMARY+' '+c['submission_bio']
        c['supporting_matters'].append({'matter_id':'primary','personal_role':'Led project work','source_quote':PRIMARY})
        c['submission_case_coverage'].append({'matter_id':'primary','source_quote':PRIMARY,'public_quote':PRIMARY})
        fixed=apply_corrections(v,targets,{'corrections':[{'path':'candidates/0','value':c,'reason':'Execute primary mandate.'}]})
        self.assertEqual(execution_errors(p,fixed,s),[])
        self.assertEqual(fixed['b10'],v['b10']);self.assertEqual(fixed['c2'],v['c2'])
        self.assertEqual(fixed['candidates'][0]['profile_coverage'],v['candidates'][0]['profile_coverage'])
        self.assertEqual((p,s,v),before)

    def test_append_cannot_change_old_bindings_category_or_existing_bio(self):
        p,s,v=anchored_case();targets={'candidates/0':repair_targets(p,s,v)['candidates/0']}
        c=copy.deepcopy(v['candidates'][0]);c['submission_bio']+=' '+PRIMARY
        c['supporting_matters'].append({'matter_id':'primary','personal_role':'Led project work','source_quote':PRIMARY})
        c['submission_case_coverage'].append({'matter_id':'primary','source_quote':PRIMARY,'public_quote':PRIMARY})
        for change in ('binding','category','bio'):
            bad=copy.deepcopy(c)
            if change=='binding':bad['submission_case_coverage'][0]['source_quote']='Different source'
            elif change=='category':bad['suggested_ranking']='Senior Statespeople'
            else:bad['submission_bio']=PRIMARY
            with self.assertRaises(ValueError):apply_corrections(v,targets,{'corrections':[{'path':'candidates/0','value':bad,'reason':'Unexpected rewrite.'}]})
