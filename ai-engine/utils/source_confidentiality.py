"""Deterministic, source-local confidentiality reconciliation; never fuzzy-match names."""
import re
import unicodedata

YES = {'y', 'yes', 'si', 'sí', '1', 'true'}
NO = {'n', 'no', '0', 'false'}


def identity(value):
    value = ''.join(c for c in unicodedata.normalize('NFKD', value or '') if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]', '', value.casefold())


def base_identity(value):
    # A legal suffix is not a different client name; no substring/fuzzy matching.
    return re.sub(r'(?:sadecv|sapidecv|srldecv)$', '', identity(value))


def client_register(text):
    entries = []
    columns = None
    # Only structured rows before the first matter; narratives cannot become permissions.
    for number, line in enumerate(text.splitlines(), 1):
        if re.match(r'^\s*\|?\s*(?:(?:Publishable|Confidential|Non[- ]publishable)\s+Matter|MATTER(?:\s+NUMBER|\s+NO\.?)?)\s+\d+', line, re.I):
            break
        cells = [cell.strip() for cell in line.strip().strip('|').split('|')]
        headings = [identity(cell) for cell in cells]
        name_col = next((i for i, h in enumerate(headings) if h in {'company', 'client', 'clientname', 'cliente', 'empresa'}), None)
        conf_col = next((i for i, h in enumerate(headings) if h in {'confidentialyn', 'confidentialyesno', 'confidencialsn', 'confidential', 'confidencial'}), None)
        if name_col is not None and conf_col is not None:
            columns = (name_col, conf_col, len(cells))
            continue
        if columns and len(cells) == columns[2]:
            name, flag = cells[columns[0]], cells[columns[1]].casefold()
            if name and flag in YES | NO:
                entries.append({'client': name, 'status': 'confidential' if flag in YES else 'not_confidential', 'quote': line.strip(), 'line': number})
        elif line.strip():
            columns = None
    return entries


def reconcile(client, matter_status, entries, source_heading):
    matches = [e for e in entries if identity(e['client']) == identity(client)] if identity(client) else []
    method = 'exact_normalized'
    if not matches and base_identity(client):
        matches = [e for e in entries if base_identity(e['client']) == base_identity(client)]
        method = 'legal_suffix'
    # Duplicate declarations and distinct entities collapsing to one name require review.
    ambiguous = len({identity(e['client']) for e in matches}) > 1 or len({e['status'] for e in matches}) > 1
    table_confidential = any(e['status'] == 'confidential' for e in matches)
    contradictory = (table_confidential and matter_status == 'publishable') or (any(e['status'] == 'not_confidential' for e in matches) and matter_status == 'confidential')
    status = matter_status
    if ambiguous or contradictory:
        status = 'confirmation_required'
    elif table_confidential:
        status = 'confidential'
    # Client-table N never authorizes publishing all the client's mandates.
    return status, {'version': 1, 'source_heading': source_heading, 'matter_status': matter_status,
                    'matched_client': client, 'match_method': method if matches else None,
                    'client_register': matches, 'requires_review': ambiguous or contradictory,
                    'basis': 'conflicting_source' if ambiguous or contradictory else 'client_register' if table_confidential else 'matter_field_or_heading'}
