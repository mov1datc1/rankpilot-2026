"""Read source bytes conservatively before extraction; never salvage binary strings."""
import hashlib
import os
import re
import tempfile
import urllib.request
from pathlib import Path
from urllib.parse import urlparse
from zipfile import ZipFile, BadZipFile
from lxml import etree
import fitz

MAX_BYTES = 30 * 1024 * 1024
MAX_EXPANDED = 120 * 1024 * 1024
MESSAGES = {
    'SOURCE_TOO_LARGE': 'El archivo excede el límite de 30 MB o su contenido descomprimido es demasiado grande. Divide el documento por asuntos.',
    'SOURCE_UNSUPPORTED': 'El contenido no corresponde a un DOCX, DOC de Word, PDF o TXT compatible. Guarda una copia DOCX desde Word; cambiar la extensión no convierte el archivo.',
    'SOURCE_CORRUPT': 'El archivo está dañado o su estructura interna no puede leerse. Ábrelo en Word y guarda una copia nueva en DOCX.',
    'SOURCE_ENCRYPTED': 'El archivo está protegido con contraseña. Sube una copia sin contraseña.',
    'SOURCE_REVISIONS': 'El Word contiene cambios controlados pendientes. Acepta o rechaza las revisiones y guarda una copia antes de subirla.',
    'SOURCE_EMBEDDED_CONTENT': 'El Word contiene contenido incrustado que no podemos leer íntegramente. Integra ese contenido como texto o tablas en un DOCX nuevo.',
    'SOURCE_OCR_REQUIRED': 'El PDF contiene páginas con imágenes sin texto legible. Sube el Word original o aplica OCR a todas las páginas y revisa el resultado antes de cargarlo.',
    'SOURCE_EMPTY': 'No encontramos texto legible en el documento. Sube una versión con texto seleccionable y los asuntos completados.',
    'SOURCE_TEXT_DAMAGED': 'El texto contiene caracteres ilegibles o dañados. Vuelve a exportar el documento desde el original.',
    'SOURCE_DOC_CONVERSION': 'No pudimos convertir este Word antiguo con fiabilidad. Ábrelo en Word o LibreOffice y guárdalo como DOCX; no basta con renombrarlo.',
    'SOURCE_UNREADABLE': 'No pudimos descargar o abrir el archivo. Vuelve a cargarlo y comprueba que puede abrirse.',
    'SOURCE_DUPLICATE_LABELS': 'Hay encabezados de asuntos repetidos. Revisa su numeración para evitar mezclar o perder asuntos.',
    'SOURCE_INCOMPLETE_MATTERS': 'Hay asuntos con datos pero sin una descripción legible del trabajo realizado. Completa esos asuntos antes de continuar.',
    'SOURCE_IDENTITY_CONFLICT': 'Los documentos indican firmas distintas. Revisa que las fuentes correspondan al mismo submission.',
    'SOURCE_UNGROUNDED_MATTERS': 'No pudimos vincular los asuntos extraídos con fragmentos literales de las fuentes. Sube el formulario DOCX completo o separa las notas por asunto.',
}

class SourceError(ValueError):
    def __init__(self, code, **details):
        self.code = code
        self.details = details
        super().__init__(MESSAGES[code])

    def as_dict(self, source):
        return {'source': source, 'code': self.code, 'message': str(self), **self.details}


def readable_text(text):
    if not text.strip():
        raise SourceError('SOURCE_EMPTY')
    damaged = text.count('\ufffd') + sum(ord(c) < 32 and c not in '\n\r\t' for c in text)
    if damaged / max(1, len(text)) > .01:
        raise SourceError('SOURCE_TEXT_DAMAGED')
    if not any(c.isalpha() for c in text):
        raise SourceError('SOURCE_EMPTY')
    return text


def docx_text(path):
    """Traverse OOXML once, preserving paragraphs, controls, nested tables and breaks."""
    try:
        with ZipFile(path) as package:
            infos = package.infolist()
            names = package.namelist()
            if len(names) != len(set(names)):
                raise SourceError('SOURCE_CORRUPT')
            if len(infos) > 5000 or sum(i.file_size for i in infos) > MAX_EXPANDED:
                raise SourceError('SOURCE_TOO_LARGE')
            if any(i.flag_bits & 1 for i in infos):
                raise SourceError('SOURCE_ENCRYPTED')
            if not {'[Content_Types].xml', 'word/document.xml'}.issubset(names):
                raise SourceError('SOURCE_UNSUPPORTED')
            parts = ['word/document.xml'] + sorted(n for n in names if re.fullmatch(r'word/(?:header\d+|footer\d+|footnotes|endnotes)\.xml', n))
            roots = []
            for name in parts:
                raw = package.read(name)
                if b'<!DOCTYPE' in raw or b'<!ENTITY' in raw:
                    raise SourceError('SOURCE_CORRUPT')
                root = etree.fromstring(raw, etree.XMLParser(resolve_entities=False, no_network=True))
                if name == 'word/document.xml' and (etree.QName(root).localname != 'document' or not root.xpath('./*[local-name()="body"]')):
                    raise SourceError('SOURCE_CORRUPT')
                if root.xpath('//*[local-name()="ins" or local-name()="del" or local-name()="moveFrom" or local-name()="moveTo"]'):
                    raise SourceError('SOURCE_REVISIONS')
                if root.xpath('//*[local-name()="altChunk" or local-name()="object"]'):
                    raise SourceError('SOURCE_EMBEDDED_CONTENT')
                rels_name = str(Path(name).parent / '_rels' / (Path(name).name + '.rels'))
                links = {}
                if rels_name in names:
                    rels_raw = package.read(rels_name)
                    if b'<!DOCTYPE' in rels_raw or b'<!ENTITY' in rels_raw:
                        raise SourceError('SOURCE_CORRUPT')
                    rels_root = etree.fromstring(rels_raw, etree.XMLParser(resolve_entities=False, no_network=True))
                    links = {rel.get('Id'): rel.get('Target') for rel in rels_root if rel.get('TargetMode') == 'External' and str(rel.get('Target', '')).startswith(('https://', 'http://'))}
                roots.append((name, root, links))
    except SourceError:
        raise
    except (BadZipFile, etree.XMLSyntaxError, OSError, KeyError, RuntimeError) as exc:
        raise SourceError('SOURCE_CORRUPT') from exc

    def walk(node):
        tag = etree.QName(node).localname if isinstance(node.tag, str) else ''
        if tag == 'AlternateContent':
            choices = [child for child in node if etree.QName(child).localname == 'Choice']
            fallbacks = [child for child in node if etree.QName(child).localname == 'Fallback']
            return walk((choices or fallbacks)[0]) if choices or fallbacks else ''
        if tag == 't':
            return node.text or ''
        if tag in ('br', 'cr'):
            return '\n'
        if tag == 'tab':
            return '\t'
        if tag in ('instrText', 'delText', 'drawing', 'pict'):
            # Text boxes are legitimate text; image pixels are not OCR evidence.
            return ''.join(walk(box) for box in node.xpath('.//*[local-name()="txbxContent"]')) if tag in ('drawing', 'pict') else ''
        if tag in ('footnoteReference', 'endnoteReference'):
            return ' '
        content = ''.join(walk(child) for child in node)
        if tag == 'hyperlink':
            relationship = next((value for key, value in node.attrib.items() if etree.QName(key).localname == 'id'), '')
            target = current_links.get(relationship, '')
            return content + (f' ({target})' if target and target not in content else '')
        if tag in ('p', 'tr', 'tbl', 'footnote', 'endnote'):
            return content.rstrip(' |\n') + '\n'
        if tag == 'tc':
            return content.strip() + ' | '
        return content

    texts = []
    for name, root, current_links in roots:
        value = walk(root).strip()
        if value:
            texts.append(value if name == 'word/document.xml' else f'\n[Contenido adicional: {Path(name).stem}]\n{value}')
    report = {'method': 'ooxml', 'parts_read': parts,
              'table_count': len(roots[0][1].xpath('//*[local-name()="tbl"]'))}
    return readable_text('\n'.join(texts)), report


def pdf_text(path):
    try:
        with fitz.open(path) as doc:
            if doc.needs_pass:
                raise SourceError('SOURCE_ENCRYPTED')
            if doc.page_count > 500:
                raise SourceError('SOURCE_TOO_LARGE')
            pages = []
            unreadable = []
            for number, page in enumerate(doc, 1):
                text = page.get_text('text', sort=True).strip()
                # Page numbers on a scan do not make its image content readable.
                if len(re.findall(r'[^\W\d_]', text)) < 20 and (page.get_images() or page.get_drawings()):
                    unreadable.append(number)
                pages.append(text)
            if unreadable:
                raise SourceError('SOURCE_OCR_REQUIRED', pages=unreadable)
            return readable_text('\n\n'.join(pages)), {'method': 'pdf_text', 'page_count': len(pages),
                'warnings': ['PDF: comprueba el orden de lectura y la correspondencia entre columnas y asuntos.']}
    except SourceError:
        raise
    except Exception as exc:
        raise SourceError('SOURCE_CORRUPT') from exc


def read_document(file_path, source_name=''):
    from utils.doc_parser import DocumentParser
    is_url = file_path.startswith(('https://', 'http://'))
    name = source_name or os.path.basename(urlparse(file_path).path)
    extension = Path(name).suffix.lower()
    with tempfile.TemporaryDirectory(prefix='rankpilot-source-') as temporary:
        local = file_path
        if is_url:
            local = os.path.join(temporary, 'source' + extension)
            try:
                request = urllib.request.Request(file_path, headers={'User-Agent': 'RankPilot/1.0'})
                with urllib.request.urlopen(request, timeout=30) as response, open(local, 'wb') as output:
                    total = 0
                    while True:
                        chunk = response.read(1024 * 1024)
                        if not chunk:
                            break
                        total += len(chunk)
                        if total > MAX_BYTES:
                            raise SourceError('SOURCE_TOO_LARGE')
                        output.write(chunk)
            except SourceError:
                raise
            except Exception as exc:
                raise SourceError('SOURCE_UNREADABLE') from exc
        try:
            if os.path.getsize(local) > MAX_BYTES:
                raise SourceError('SOURCE_TOO_LARGE')
            data = Path(local).read_bytes()
        except OSError as exc:
            raise SourceError('SOURCE_UNREADABLE') from exc
        if not data:
            raise SourceError('SOURCE_EMPTY')
        if data.startswith(b'PK'):
            actual = 'docx'
            text, report = docx_text(local)
        elif data[:1024].lstrip().startswith(b'%PDF-'):
            actual = 'pdf'
            text, report = pdf_text(local)
        elif data.startswith(bytes.fromhex('D0CF11E0A1B11AE1')):
            if 'EncryptedPackage'.encode('utf-16le') in data:
                raise SourceError('SOURCE_ENCRYPTED')
            if 'WordDocument'.encode('utf-16le') not in data:
                raise SourceError('SOURCE_UNSUPPORTED')
            actual = 'doc'
            # Converters require the real suffix, not the uploaded file's name.
            legacy_path = os.path.join(temporary, 'legacy.doc')
            Path(legacy_path).write_bytes(data)
            text = readable_text(DocumentParser._parse_doc(legacy_path))
            report = {'method': 'legacy_converter', 'warnings': ['Word antiguo convertido: revisa especialmente la separación de tablas y asuntos.']}
        elif extension == '.txt' and b'\0' not in data:
            actual = 'txt'
            try:
                text = readable_text(data.decode('utf-8-sig'))
            except UnicodeDecodeError as exc:
                raise SourceError('SOURCE_TEXT_DAMAGED') from exc
            report = {'method': 'utf8_text'}
        else:
            raise SourceError('SOURCE_UNSUPPORTED')
        if extension != '.' + actual:
            report.setdefault('warnings', []).append(f'La extensión {extension or "ausente"} no coincide con el contenido {actual.upper()}; se leyó el formato real.')
        return text, {'source': name, 'detected_format': actual, 'sha256': hashlib.sha256(data).hexdigest(),
                      'byte_count': len(data), 'character_count': len(text), **report}
