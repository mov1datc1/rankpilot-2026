import copy
import hashlib
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile
from xml.sax.saxutils import escape
from core.quality_regression import evaluate, RUBRIC


class QualityRegressionTests(unittest.TestCase):
    def test_frozen_baseline_detects_real_omission_and_diagnostic_without_a_model(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            def doc(name,text):
                path=root/name
                with ZipFile(path,'w') as archive:
                    archive.writestr('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>'+escape(text)+'</w:t></w:r></w:p></w:body></w:document>')
                return {'path':name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
            audit=doc('audit.docx','Portfolio: integration for 4,200 employees.')
            good=doc('good.docx','E2: integration for 4,200 employees. E3: confidential')
            bad=doc('bad.docx','E2: integration across facilities. E3: confidential')
            diagnostic=doc('diagnostic.docx','Portfolio: integration for 4,200 employees. Internal candidates/1 binding failure.')
            case={'id':'synthetic','baseline':{'audit':audit,'submission':good},
                  'candidate':{'audit':diagnostic,'submission':bad},'checks':[
                    {'id':'scale','artifact':'submission','scope':r'E2:(?P<field>.*?)E3:', 'mode':'required','pattern':r'4,200 employees'},
                    {'id':'no_diagnostic','artifact':'audit','mode':'forbidden','pattern':r'candidates/\d'}]}
            report=evaluate({'cases':[case]},root)['cases'][0]
            self.assertEqual(report['regressions'],['scale','no_diagnostic'])
            self.assertFalse(report['release_quality_ready'])
            case['candidate']=copy.deepcopy(case['baseline'])
            report=evaluate({'cases':[case]},root)['cases'][0]
            self.assertEqual(report['regressions'],[])
            self.assertFalse(report['release_quality_ready']) # local checks are not editorial acceptance
            case['human_review']={'artifact_hashes':report['artifact_hashes'],'reviewer':'Reviewer',
                'decision':'accept','evidence':'Read both files against the supplied synthetic source.',
                'rubric':{k:{'score':8,'evidence':'Synthetic acceptance evidence for '+k} for k in RUBRIC}}
            case['baseline_review']=copy.deepcopy(case['human_review'])
            self.assertTrue(evaluate({'cases':[case]},root)['release_quality_ready'])
            case['human_review']['rubric']['personal_case_b9']['score']=7
            self.assertEqual(evaluate({'cases':[case]},root)['cases'][0]['rubric_regressions'],['personal_case_b9'])
            self.assertFalse(evaluate({'cases':[case]},root)['release_quality_ready'])
            case['candidate']['submission']=bad
            self.assertFalse(evaluate({'cases':[case]},root)['release_quality_ready'])
            case['baseline']['audit']['sha256']='incorrect'
            with self.assertRaisesRegex(ValueError,'hash mismatch'):evaluate({'cases':[case]},root)

    def test_an_absent_or_duplicate_field_never_passes_by_matching_elsewhere(self):
        from core.quality_regression import check
        rule={'mode':'required','scope':r'E2:(?P<field>.*?)E3:', 'pattern':'4,200'}
        self.assertFalse(check('Audit: 4,200 employees.',rule)['passed'])
        self.assertFalse(check('E2: 4,200 E3: E2: 4,200 E3:',rule)['passed'])
