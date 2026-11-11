import sys
import json
import tempfile
import unittest
from pathlib import Path

AI_ENGINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(AI_ENGINE))

from utils.rag_router import RAGRouter  # noqa: E402


class RAGRouterTests(unittest.TestCase):
    def test_production_context_quarantines_historical_client_blueprints(self):
        router=RAGRouter()
        for task in ('development narrative', 'writer leadership', 'editor preservation', 'strategist selection'):
            chunks=router.retrieve('Labour & Employment','Chambers','Mexico',task=task)
            sources={c.source for c in chunks}
            self.assertEqual(sources,{'Editorial_Methodology_Scoped.txt',
                'Lawyer_Leadership_Methodology_Scoped.txt','Labour_Editorial_Methodology_Scoped.txt'})
            text='\n'.join(c.text for c in chunks)
            for leaked in ('Schaeffler','DeForest','Vitesco','4 states','BRL 8M',
                           'Supreme Editorial Law','ALWAYS outperform','Partner X led'):
                self.assertNotIn(leaked,text)
            self.assertIn('firm\'s voice',text)
            self.assertIn('internal Audit',text)
            self.assertIn('who performed a specific action',text)
        for entry in router.catalog['quarantined_documents']:
            self.assertTrue((Path(router.knowledge_dir)/entry['source']).exists())

    def test_practice_directory_matrix_has_only_matching_methodology(self):
        router=RAGRouter()
        names={'banking':'Banca y Finanzas','tax':'Derecho Tributario','labour':'Laboral',
            'corporate':'Fusiones y Adquisiciones','disputes':'Arbitraje','competition':'Competencia',
            'ip':'Protección de datos','regulatory':'Derecho Administrativo','energy':'Energía y Minería',
            'real_estate':'Bienes raíces','compliance':'Compliance'}
        catalog={e['source']:e for e in router.catalog['documents']}
        for family,name in names.items():
            for directory in ('Chambers','Legal 500'):
                with self.subTest(practice=name,directory=directory):
                    chunks=router.retrieve(name,directory,role='development',unit='matters')
                    self.assertEqual(router.last_routing['practices'],[family])
                    self.assertTrue(any(catalog[c.source]['practice']==family for c in chunks))
                    self.assertTrue(all(catalog[c.source]['practice'] in (family,'*') for c in chunks))
                    self.assertNotIn('Lawyer_Leadership_Methodology_Scoped.txt',{c.source for c in chunks})
                    text=' '.join(c.text for c in chunks)
                    for forbidden in ('GBP 500 million','approximate value band','Leave blank unless','Chedraui','AIDA','DISCARD'):
                        self.assertNotIn(forbidden,text)

    def test_mixed_unknown_and_short_alias_routes(self):
        router=RAGRouter()
        router.retrieve('Tax Litigation / Fusiones y Adquisiciones','Chambers')
        self.assertEqual(set(router.last_routing['practices']),{'tax','disputes','corporate'})
        chunks=router.retrieve('Shipping','Legal 500')
        self.assertEqual(router.last_routing['practices'],[])
        self.assertTrue(router.last_routing['general_only'])
        self.assertEqual({c.source for c in chunks},{'Editorial_Methodology_Scoped.txt','Lawyer_Leadership_Methodology_Scoped.txt'})
        self.assertEqual(router._practice_families('IP'),('ip',))
        self.assertEqual(router.retrieve('Tax','Unknown directory'),[])

    def test_unit_context_preserves_ownership_without_personal_strategy_in_matter_writing(self):
        router=RAGRouter()
        for unit in ('plan','bio','matters','institutional'):
            chunks=router.retrieve('Tax','Chambers',role='development',unit=unit)
            self.assertEqual('Lawyer_Leadership_Methodology_Scoped.txt' in {c.source for c in chunks},unit in ('plan','bio'))
            self.assertIn('Editorial_Methodology_Scoped.txt',{c.source for c in chunks})

    def test_exact_edition_jurisdiction_directory_and_role_scope(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            (root/'local.txt').write_text('Only this local guide.',encoding='utf-8')
            entry=dict(source='local.txt',practice='tax',directory='chambers',jurisdiction='Mexico',edition='2026',guide_region='Latin America',tier='reference',approval='project_reference_only',roles=['strategist'])
            (root/'rag_catalog.v2.json').write_text(json.dumps({'documents':[entry]}))
            router=RAGRouter(directory)
            args=dict(practice_area='Tax',directory='Chambers',jurisdiction='Mexico',edition='2026',guide_region='Latin America',role='strategist')
            self.assertEqual(len(router.retrieve(**args)),1)
            for field,value in [('directory','Legal 500'),('jurisdiction','UK'),('edition','2027'),('guide_region','Europe'),('role','development')]:
                self.assertEqual(router.retrieve(**{**args,field:value}),[])

    def test_long_sentence_is_not_cut_before_its_qualifier(self):
        sentence='Long contextual instruction ' + ('word ' * 600) + 'only when supported by the source.'
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            (root/'long.txt').write_text(sentence)
            (root/'rag_catalog.v2.json').write_text(json.dumps({'documents':[dict(source='long.txt',practice='tax',directory='chambers',tier='reference',approval='project_reference_only')]}))
            chunks=RAGRouter(directory).retrieve('Tax','Chambers')
            self.assertEqual(''.join(c.text for c in chunks),sentence)
            self.assertTrue(chunks[-1].text.endswith('only when supported by the source.'))

    def test_routes_chunks_and_exposes_provenance(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "Real_Estate_Methodology.txt").write_text(
                "# Category fit\n\nReal estate matters require property evidence.\n\n# Outcomes\n\nDistinguish interim relief from final judgments.", encoding="utf-8"
            )
            (root / "Corporate_MA_Methodology.txt").write_text("M&A acquisition method only.", encoding="utf-8")
            (root / "rag_catalog.v2.json").write_text(json.dumps({"version":"test", "documents":[{"source":"Real_Estate_Methodology.txt","practice":"real_estate","directory":"chambers","tier":"reference","approval":"project_reference_only"}]}))
            router = RAGRouter(directory)
            context = router.get_rag_context("Real Estate", "Chambers")
            self.assertIn("NOT SUBMISSION EVIDENCE", context)
            self.assertIn("Real_Estate_Methodology.txt", context)
            self.assertNotIn("M&A acquisition method only", context)
            self.assertTrue(router.get_rag_manifest()[0]["chunk_id"].startswith("rag-"))


if __name__ == "__main__":
    unittest.main()
