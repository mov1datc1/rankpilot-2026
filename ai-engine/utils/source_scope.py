"""Literal scope declarations only; cross-border clients and narrative mentions are not scope."""
import re

_LABELS = {
    'practice_area': r'(?:A2\s+)?(?:Practice\s+Area|Área\s+de\s+práctica|Area\s+de\s+practica)',
    'jurisdiction': r'(?:A3\s+)?(?:Location(?:\s*\(Jurisdiction\))?|Jurisdiction|Jurisdicción|Jurisdiccion|País|Pais|Country)',
    'guide_region': r'(?:Guide(?:\s*/\s*Region)?|Guía(?:\s*/\s*Región)?|Guia(?:\s*/\s*Region)?)',
    'directory': r'(?:Target\s+Directory|Directory|Directorio)',
}

def source_scope(text):
    lines = (text or '').splitlines()
    result = {}
    for index, line in enumerate(lines):
        for field, label in _LABELS.items():
            if field in result:
                continue
            match = re.fullmatch(r'\s*' + label + r'\s*(?:[:|\-–—]\s*(.*?)|\s{2,}(.*?))?\s*', line, re.I)
            if not match:
                continue
            value = (match.group(1) or match.group(2) or '').strip(' |\t')
            quote = line.strip()
            if not value:
                following = next((v.strip(' |\t') for v in lines[index+1:index+4] if v.strip()), '')
                if following and not any(re.match(r'^' + other + r'\b', following, re.I) for other in _LABELS.values()):
                    value = following
                    quote += '\n' + following
            if value and len(value) <= 80 and '?' not in value and not re.match(r'^[A-E]\d+\b', value):
                result[field] = {'value': value, 'quote': quote}
    # Identify template ownership from its intake instructions, never from a
    # firm's narrative saying that it was ranked in a different directory.
    if 'directory' not in result:
        signatures = [
            ('Chambers & Partners', r'Please upload submissions online at:[^\n]*myaccount\.chambers\.com'),
            ('Legal 500', r'Please contact researchreports@legal500\.com for further information\.'),
            ('Legal 500', r'(?:THE\s+)?LEGAL\s+500[^\n]*(?:SUBMISSION|RESEARCH)\s+(?:FORM|TEMPLATE)'),
            ('Leaders League', r'Leaders\s+League\s*[\r\n]+\s*(?:\d+,\s*boulevard\b|Paris\b)'),
            ('Leaders League', r'(?:position\s+in\s+)?Leaders\s+League[’\x27]s\s+[^\n]*ranking'),
            ('Leaders League', r'(?:THE\s+)?LEADERS\s+LEAGUE[^\n]*(?:SUBMISSION|RESEARCH)\s+(?:FORM|TEMPLATE)'),
            ('IFLR1000', r'(?:THE\s+)?IFLR\s*1000[^\n]*(?:SUBMISSION|RESEARCH)\s+(?:FORM|TEMPLATE|PORTAL)'),
            ('Latin Lawyer', r'(?:THE\s+)?LATIN\s+LAWYER[^\n]*(?:SUBMISSION|RESEARCH)\s+(?:FORM|TEMPLATE)'),
        ]
        intro_and_footers = text[:8000]
        if '[Contenido adicional:' in text:
            intro_and_footers += '\n' + text[text.find('[Contenido adicional:'):]
        matches = [(value, m.group()) for value, pattern in signatures for m in [re.search(pattern, intro_and_footers, re.I)] if m]
        if len(set(value for value, _ in matches)) == 1:
            result['directory'] = {'value': matches[0][0], 'quote': matches[0][1]}
    return result


def validate_draft_directory(text, target):
    from utils.document_preflight import SourceError
    normalize = lambda value: re.sub(r'[^a-z0-9]', '', value.casefold()).replace('and', '').replace('partners', '').removeprefix('the')
    evidence = source_scope(text).get('directory')
    if not evidence:
        raise SourceError('SOURCE_DIRECTORY_UNKNOWN', selected=target)
    if normalize(evidence['value']) != normalize(target):
        raise SourceError('SOURCE_DIRECTORY_MISMATCH', selected=target, detected=evidence['value'], quote=evidence['quote'])
