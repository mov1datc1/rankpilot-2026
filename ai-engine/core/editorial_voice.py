"""Shared narrow editorial rules, used before repair and on rendered text."""
import json
import re
from pathlib import Path

RULES = json.loads(Path(__file__).with_name('editorial_voice_rules.json').read_text())
PATTERNS = [re.compile(pattern, re.I) for pattern in RULES['patterns']]


def voice_matches(text):
    return [match.group() for pattern in PATTERNS if (match := pattern.search(str(text or '')))]


def rendered_voice_defects(package, development=None):
    rendered = ' '.join(str(package.get('rendered_artifact') or '').split())
    if not rendered:
        return []
    development = development or {}
    fields = {key: development.get(key, '') for key in ('b10', 'c2')}
    for kind, keys in (('matters', ('text', 'completion_status')), ('candidates', ('submission_bio',))):
        for i, item in enumerate(development.get(kind, [])):
            fields.update({f'{kind}/{i}/{key}': item.get(key, '') for key in keys})
    defects, bound_matches = [], set()
    for path, value in fields.items():
        matches = [m for m in voice_matches(value) if ' '.join(m.split()) in rendered]
        if not matches:
            continue
        bound_matches.update(' '.join(m.split()) for m in matches)
        # Bind to the editable generated field; the repairer has its sources.
        defects.append({'code': 'EDITORIAL_STYLE', 'severity': 'critical', 'scope': 'submission',
                        'field_path': path, 'matter_id': None, 'source_quote': '',
                        'artifact_quote': value if ' '.join(str(value).split()) in rendered else matches[0],
                        'message': 'Retira la voz auditora o la petición formularia del campo generado. Conserva los hechos, roles y límites reales del resultado; no inventes un estado para sustituir datos ausentes.'})
    for match in voice_matches(rendered):
        if match not in bound_matches:
            defects.append({'code': 'EDITORIAL_STYLE', 'severity': 'critical', 'scope': 'submission',
                            'field_path': '', 'matter_id': None, 'source_quote': '', 'artifact_quote': match,
                            'message': 'El Word contiene comentarios sobre la fuente o una petición formularia. Corrige el texto generado sin alterar los hechos originales.'})
    return defects
