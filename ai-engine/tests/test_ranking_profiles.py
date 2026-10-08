import copy
import json
import unittest
from unittest.mock import patch
from datetime import datetime,timezone
from utils.ranking_profiles import parse_profile,official_url,VERSION
from utils.ranking_verifier import verify_ranking_claim,research_scope

class ProfileResearchTests(unittest.TestCase):
    def document(self,**changes):
        identity={'fullName':'Sofia Vega','organisationName':'Example Legal','personOrganisationId':7,'latestPublication':{'id':10,'year':2027},'rankings':[{'practiceAreaName':'Tax','locationName':'Mexico'}],**changes}
        editorial={'personOrganisationId':7,'publicationId':10,'practiceAreaName':'Tax','locationName':'Mexico','sections':[{'heading':'Individual Editorial','content':[{'body':'<p>Advises on tax disputes.</p>','locale':'en-GB'}]}]}
        return '<script type="application/json">'+json.dumps({'a':{'b':identity},'b':{'b':[{'personEditorials':[editorial]}]},'c':{'b':{'providedProfiles':'Self-promotional invented praise'}}})+'</script>'
    def parse(self,document=None,**changes):
        args={'document':document or self.document(),'url':'https://chambers.com/lawyer/sofia-9:7','subject':{'kind':'individual','name':'Sofia Vega','firm':'Example Legal'},'practice':'Tax','country':'Mexico','edition':'current',**changes}
        return parse_profile(**args)
    def test_scoped_commentary_excludes_firm_supplied_bio(self):
        result=self.parse();self.assertEqual(result['status'],'retrieved');self.assertEqual(result['edition'],2027)
        self.assertEqual(result['commentary'][0]['text'],'Advises on tax disputes.')
        self.assertNotIn('Self-promotional',str(result));self.assertEqual(len(result['content_sha256']),64)
    def test_wrong_scope_identity_employer_and_edition_fail(self):
        for change in ({'practice':'Real Estate'},{'country':'Venezuela'},{'edition':'2026'}, {'subject':{'kind':'individual','name':'Sofia Vega','firm':'Other Firm'}}, {'subject':{'kind':'individual','name':'Sofia Other','firm':'Example Legal'}}):
            with self.subTest(change=change):self.assertEqual(self.parse(**change)['status'],'scope_or_identity_unresolved')
    def test_unofficial_urls_and_redirect_targets_rejected(self):
        for url in ('https://chambers.com.evil.test/lawyer/a','http://chambers.com/lawyer/a','https://chambers.com@evil.test/lawyer/a','https://chambers.com/law-firm/a','https://chambers.com:444/lawyer/a'):
            with self.assertRaises(ValueError):official_url(url)
        self.assertEqual(official_url('/lawyer/a'),'https://chambers.com/lawyer/a')
    def test_same_scope_reuses_snapshot_without_fetches(self):
        package={'firm_name':'Example Legal','practice_area':'Tax','lawyers':[{'name':'Sofia Vega'}]}
        previous={'research_scope':research_scope(package),'profile_research':{'version':VERSION},'checked_at':datetime.now(timezone.utc).isoformat()}
        with patch('utils.ranking_verifier.scrape_rankings') as table,patch('utils.ranking_profiles.research_profiles') as profiles:
            result=verify_ranking_claim(package,previous)
        table.assert_not_called();profiles.assert_not_called();self.assertEqual(result['research_execution'],'reused_current_scoped_snapshot')
        self.assertNotIn('research_execution',previous)
    def test_changed_scope_does_not_reuse_old_profiles(self):
        package={'firm_name':'Example Legal','practice_area':'Tax','lawyers':[]}
        previous={'research_scope':research_scope(package),'profile_research':{'version':VERSION},'checked_at':datetime.now(timezone.utc).isoformat()}
        with patch('utils.ranking_verifier.scrape_rankings',return_value=None) as table,patch('utils.ranking_profiles.research_profiles',return_value={'version':VERSION}) as profiles:
            result=verify_ranking_claim({**package,'practice_area':'Banking'},previous)
        table.assert_called_once();profiles.assert_called_once();self.assertEqual(result['research_execution'],'retrieved_table_and_profiles')
    def test_name_variant_requires_explicit_source_profile_and_matching_employer(self):
        document=self.document(fullName='Sofia Vega Montes')
        self.assertEqual(self.parse(document)['status'],'scope_or_identity_unresolved')
        linked={'kind':'individual','name':'Sofia Vega','firm':'Example Legal','identity_basis':'source_supplied_official_profile'}
        self.assertEqual(self.parse(document,subject=linked)['status'],'retrieved')
        self.assertEqual(self.parse(document,subject={**linked,'firm':'Other Firm'})['status'],'scope_or_identity_unresolved')
        self.assertEqual(self.parse(document,subject={**linked,'name':'Sofia Perez'})['status'],'scope_or_identity_unresolved')
