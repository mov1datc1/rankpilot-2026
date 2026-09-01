"""Structural validation for DOCX files delivered by RankPilot."""

from io import BytesIO
from typing import List, Union
from zipfile import BadZipFile, ZipFile
from xml.etree import ElementTree as ET


W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
W = f"{{{W_NS}}}"


def validate_docx_ooxml(payload: Union[bytes, str]) -> List[str]:
    """Return errors for malformed packages and Google Docs-unsafe tables."""

    errors: List[str] = []
    try:
        source = BytesIO(payload) if isinstance(payload, bytes) else payload
        with ZipFile(source) as package:
            required = {"[Content_Types].xml", "word/document.xml"}
            missing = sorted(required - set(package.namelist()))
            if missing:
                return [f"Missing OOXML parts: {', '.join(missing)}"]
            document = ET.fromstring(package.read("word/document.xml"))
    except (BadZipFile, ET.ParseError, OSError) as exc:
        return [f"Invalid DOCX package: {exc}"]

    for index, table in enumerate(document.findall(f".//{W}tbl"), start=1):
        table_width = table.find(f"./{W}tblPr/{W}tblW")
        if table_width is None:
            errors.append(f"Table {index} has no explicit tblW")
        else:
            width_type = table_width.get(f"{W}type")
            width_value = table_width.get(f"{W}w")
            if width_type != "dxa":
                errors.append(f"Table {index} uses non-DXA width type {width_type!r}")
            if not width_value or not width_value.isdigit() or int(width_value) <= 0:
                errors.append(f"Table {index} has invalid width {width_value!r}")

        grid_columns = table.findall(f"./{W}tblGrid/{W}gridCol")
        if not grid_columns:
            errors.append(f"Table {index} has no tblGrid/gridCol definitions")
        for column_index, column in enumerate(grid_columns, start=1):
            width = column.get(f"{W}w")
            if not width or not width.isdigit() or int(width) <= 0:
                errors.append(
                    f"Table {index} grid column {column_index} has invalid width {width!r}"
                )
    return errors
