import sys
import unittest
from io import BytesIO
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


AI_ENGINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(AI_ENGINE))

from utils.ooxml_validation import validate_docx_ooxml  # noqa: E402
from core.docx_cloner import _normalize_docx_table_widths  # noqa: E402
from docx import Document  # noqa: E402


def package(document_xml: str) -> bytes:
    stream = BytesIO()
    with ZipFile(stream, "w", ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", "<Types/>")
        archive.writestr("word/document.xml", document_xml)
    return stream.getvalue()


class OoxmlValidationTests(unittest.TestCase):
    def test_dxa_table_passes(self):
        xml = """<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/></w:tblPr><w:tblGrid><w:gridCol w:w="4680"/><w:gridCol w:w="4680"/></w:tblGrid></w:tbl></w:body></w:document>"""
        self.assertEqual([], validate_docx_ooxml(package(xml)))

    def test_percentage_and_zero_grid_fail(self):
        xml = """<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl><w:tblPr><w:tblW w:w="100" w:type="pct"/></w:tblPr><w:tblGrid><w:gridCol w:w="0"/></w:tblGrid></w:tbl></w:body></w:document>"""
        errors = validate_docx_ooxml(package(xml))
        self.assertTrue(any("non-DXA" in error for error in errors))
        self.assertTrue(any("invalid width" in error for error in errors))

    def test_cloner_normalizes_all_tables_to_dxa(self):
        document = Document()
        table = document.add_table(rows=1, cols=2)
        table.cell(0, 0).text = "Left"
        table.cell(0, 1).text = "Right"
        _normalize_docx_table_widths(document)
        stream = BytesIO()
        document.save(stream)
        self.assertEqual([], validate_docx_ooxml(stream.getvalue()))


if __name__ == "__main__":
    unittest.main()
