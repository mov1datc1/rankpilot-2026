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
    return result
