"""Conservative recognition of an author's explicitly dated status update.

This preserves BOTH literal passages; it never invents a current status/date.
It is not a general conflict resolver and does not apply to identities or money.
"""
import re

YEAR = r'\b(?:19|20)\d{2}\b'
UPDATE = re.compile(r'^\s*(?:UPDATE|ACTUALIZACI[ÓO]N)\s*[:–—-]?\s*((?:19|20)\d{2})\s*[:–—-]?\s*$', re.I)
PENDING = re.compile(r'\b(?:pending|under review|gathering .*?evidence|awaiting|expected|pendiente|en revisi[óo]n|se espera)\b', re.I)
DECISION = re.compile(r'\b(?:ruling|judgment|judgement|decision|sentencia|resoluci[óo]n)\b', re.I)
RESULT = re.compile(r'\b(?:upheld|enforced|granted|denied|dismissed|reversed|obtained|confirm[óo]|ejecutad[ao]|concedi[óo]|desestim[óo]|obtuvo)\b', re.I)


def explicit_status_update(parts, spans, lines):
    if len(parts) != 2 or spans[0].end >= spans[1].start:
        return None
    # A model cannot hide an intervening inconsistent statement by omitting it.
    if any(line.strip() for line in lines[spans[0].end:spans[1].start-1]):
        return None
    old, updated = parts
    nonempty = [line for line in updated.splitlines() if line.strip()]
    if not nonempty:
        return None
    marker = UPDATE.fullmatch(nonempty[0])
    if not marker or sum(bool(UPDATE.fullmatch(line)) for line in old.splitlines()+nonempty) != 1:
        return None
    year = int(marker.group(1))
    older_years = {int(y) for y in re.findall(YEAR, old)}
    if not older_years or max(older_years) >= year or not PENDING.search(old):
        return None
    body = '\n'.join(nonempty[1:])
    if not DECISION.search(body) or not RESULT.search(body):
        return None
    # Require explicit continuity of dated proceedings, excluding predictions.
    historical = re.sub(r'\b(?:expected|anticipated|previst[ao]|se espera)[^.\n]*', '', old, flags=re.I)
    proceeding_years = set(re.findall(YEAR, historical))
    if not proceeding_years or not proceeding_years.issubset(set(re.findall(YEAR, body))):
        return None
    # Multiple opposed outcomes in the update need semantic/human resolution.
    positive = re.search(r'\b(?:upheld|granted|favorable|favourable|concedi[óo])\b', body, re.I)
    negative = re.search(r'\b(?:denied|dismissed|unfavorable|unfavourable|desestim[óo])\b', body, re.I)
    if positive and negative:
        return None
    return {'kind': 'explicit_temporal_update', 'latest_update_year': year,
            'policy': 'Preserve historical status and subsequent literal update; no inferred activity after the update.'}
