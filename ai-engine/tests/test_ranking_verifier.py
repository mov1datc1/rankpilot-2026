import unittest
from datetime import datetime,timezone,timedelta
from utils.ranking_verifier import compare_claim, compare_individual_claim
from utils.benchmark_scraper import Legal500Scraper, ChambersScraper
import json

class RankingVerificationTests(unittest.TestCase):
    def test_individual_observation_uses_own_edition_and_exact_person_and_firm(self):
        benchmark = self.evidence(edition='2027', individuals=[{'name':'Sofia Vega','firm':'Synthetic Legal','band':'Band 2','edition':'2026'}])
        lawyer = {'name':'Sofia Vega','current_ranking':'Band 2'}
        result = compare_individual_claim(lawyer,'Synthetic Legal','Chambers','Tax','Mexico','2026',benchmark)
        self.assertEqual(result['status'],'verified_match')
        self.assertEqual(result['evidence']['edition'],'2026')
        wrong = compare_individual_claim(lawyer,'Synthetic Different','Chambers','Tax','Mexico','2026',benchmark)
        self.assertEqual(wrong['status'],'not_found')

    def test_individual_rank_never_transfers_practice_or_firm_edition(self):
        benchmark = self.evidence(individuals=[{'name':'Sofia Vega','firm':'Synthetic Legal','band':'Band 2'}])
        lawyer = {'name':'Sofia Vega'}
        self.assertEqual(compare_individual_claim(lawyer,'Synthetic Legal','Chambers','Labour','Mexico','current',benchmark)['status'],'scope_mismatch')
        self.assertEqual(compare_individual_claim(lawyer,'Synthetic Legal','Chambers','Tax','Mexico','2027',benchmark)['status'],'edition_required')
    def evidence(self,**changes):
        return {**{'source':'chambers','source_url':'https://chambers.com/legal-rankings/example','content_sha256':'a'*64,'parser_version':'ranking-evidence-v1','scraped_at':datetime.now(timezone.utc).isoformat(),'edition':'2027','observed_practice':'Tax','observed_jurisdiction':'Mexico','firms':[{'name':'Synthetic Legal','band':'Band 3'}]},**changes}
    def verify(self,benchmark=None,firm='Synthetic Legal',band='Band 2',edition='2027'):
        return compare_claim(firm,'Chambers','Tax','Mexico',band,edition,benchmark)
    def test_mismatch_is_not_silently_rewritten(self):
        r=self.verify(self.evidence());self.assertEqual(r['status'],'verified_mismatch');self.assertEqual(r['declared_band'],'Band 2');self.assertEqual(r['observed_band'],'Band 3')
    def test_exact_match(self):self.assertEqual(self.verify(self.evidence(),band='Band 3')['status'],'verified_match')
    def test_first_word_does_not_match(self):self.assertEqual(self.verify(self.evidence(),firm='Synthetic Different')['status'],'not_found')
    def test_failure_does_not_mean_unranked(self):self.assertEqual(self.verify()['status'],'unavailable')
    def test_not_found_does_not_confirm_unranked(self):self.assertEqual(self.verify(self.evidence(firms=[]),band='Unranked')['status'],'not_found')
    def test_individual_rank_does_not_rank_firm(self):self.assertEqual(self.verify(self.evidence(firms=[],individuals=[{'firm':'Synthetic Legal','band':'Band 2'}]))['status'],'not_found')
    def test_country_must_match(self):self.assertEqual(self.verify(self.evidence(observed_jurisdiction='Venezuela'))['status'],'scope_mismatch')
    def test_practice_must_match(self):self.assertEqual(self.verify(self.evidence(observed_practice='Banking'))['status'],'scope_mismatch')
    def test_edition_must_match(self):self.assertEqual(self.verify(self.evidence(),edition='2026')['status'],'edition_mismatch')
    def test_unknown_edition_does_not_verify(self):self.assertEqual(self.verify(self.evidence(edition=None))['status'],'edition_required')
    def test_requested_edition_required(self):self.assertEqual(self.verify(self.evidence(),edition='')['status'],'edition_required')
    def test_stale_data_does_not_verify(self):self.assertEqual(self.verify(self.evidence(scraped_at=(datetime.now(timezone.utc)-timedelta(days=2)).isoformat()))['status'],'stale')
    def test_future_timestamp_rejected(self):self.assertEqual(self.verify(self.evidence(scraped_at=(datetime.now(timezone.utc)+timedelta(days=1)).isoformat()))['status'],'stale')
    def test_unofficial_host_rejected(self):self.assertEqual(self.verify(self.evidence(source_url='https://chambers.com.evil.test/'))['status'],'unavailable')
    def test_old_parser_cache_rejected(self):self.assertEqual(self.verify(self.evidence(parser_version=None))['status'],'unavailable')
    def test_ambiguous_identity(self):self.assertEqual(self.verify(self.evidence(firms=[{'name':'Synthetic Legal','band':'Band 2'},{'name':'Synthetic Legal','band':'Band 3'}]))['status'],'ambiguous')
    def test_legal500_rows_are_bounded(self):
        html='<title>L500 | Tax in Mexico | Firms</title><ul data-testid="ranking-group"><h3 class="sr-only">Tier 3</h3><li data-testid="ranking-table-row"><a href="/rankings/ranking/test/1"><h4 class="typography-interface-l-bold">Synthetic &amp; Legal</h4></a></li></ul><h4 class="typography-interface-l-bold">Footer Fake</h4><p>Copyright 2027</p>'
        r=Legal500Scraper.parse(html,'Tax','Mexico');self.assertEqual(len(r['firms']),1);self.assertIsNone(r['edition']);self.assertEqual(r['firms'][0]['name'],'Synthetic & Legal')
    def test_chambers_firm_edition_not_lawyer_edition(self):
        state={'a':{'b':{'subsection':{'practiceAreaDescription':'Tax','locationDescription':'Mexico'}}},'b':{'b':{'description':'Departments','categories':[{'description':'Band 3','organisations':[{'organisationName':'Synthetic Legal','publicationYear':2027}]}]}},'c':{'b':{'description':'Lawyers','categories':[{'description':'Band 1','individuals':[{'displayName':'Person','publicationYear':2026}]}]}},'d':{}}
        r=ChambersScraper.parse('<script type="application/json">'+json.dumps(state)+'</script>','Tax','Mexico');self.assertEqual(r['edition'],'2027');self.assertEqual(r['firms'][0]['band'],'Band 3')

    def test_live_table_scope_does_not_invent_legal500_edition(self):
        bm=self.evidence(source='legal500',source_url='https://www.legal500.com/c/mexico/tax',edition=None,firms=[{'name':'Synthetic Legal','band':'Tier 3'}])
        r=compare_claim('Synthetic Legal','Legal 500','Tax','Mexico','Tier 3','current',bm)
        self.assertEqual(r['status'],'verified_match');self.assertIsNone(r['evidence']['edition']);self.assertEqual(r['comparison_scope'],'current_table_as_of_retrieval')
