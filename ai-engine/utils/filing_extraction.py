"""Source-backed administrative fields, kept separate from firm-wide totals.

Missing and conflicting values are not zero. Evidence survives multi-file ingestion.
"""
import re
import json

FIELDS = ('departmentName', 'numPartners', 'numLawyers', 'contacts', 'departmentHeads')


def extract_filing_fields(text):
    text = text.replace('\x07', ' | ')
    findings = {key: [] for key in FIELDS}

    def add(key, value, quote):
        item = {'value': value, 'quote': quote.strip()}
        if item not in findings[key]:
            findings[key].append(item)

    # Explicit Chambers fields, including inline and table-flattened answers.
    labels = {
        'departmentName': r'(?:(?:B1\s+)?(?:What\s+is\s+the\s+)?(?:Team\s+or\s+)?Department\s+name(?:\s*\([^)]*\))?|(?:B1\s+)?Department\s+name(?:\s*\(used by firm\))?)',
        'numPartners': r'(?:B2\s+(?:Number of partners|No\.? of partners)|Number\s+of\s+PARTNERS(?:\s+in\s+the\s+team)?)',
        'numLawyers': r'(?:B3\s+(?:Number of (?:other )?(?:qualified )?lawyers|No\.? of lawyers)|Number of NON-PARTNERS(?:\s+in\s+the\s+team)?|Non-partners\s+who\s+spend[^\n|]*)',
    }
    for key, label in labels.items():
        value = r'([^\n|]{1,100})' if key == 'departmentName' else r'(\d{1,5})'
        for match in re.finditer(r'^\s*' + label + r'[ \t:|]*\n?\s*' + value + r'[ \t]*(?=\n|\||$)', text, re.I | re.M):
            answer = match.group(1).strip()
            if key == 'departmentName' and (re.match(r'B\d\b', answer) or answer.lower() in ('n/a', 'not provided')):
                continue
            add(key, answer if key == 'departmentName' else int(answer), match.group())

    # Fallback headcount extraction from pipe-delimited Legal 500 partner tables
    if 'numPartners' not in findings:
        p_m = re.search(r'(?im)Number\s+of\s+PARTNERS\b.*?(?:\|\s*(\d{1,5})\s*\|)', text, re.S)
        if p_m:
            add('numPartners', int(p_m.group(1)), p_m.group())
    if 'numLawyers' not in findings:
        np_m = re.search(r'(?im)Non-partners\s+who\s+spend\b.*?\|\s*(\d{1,5})', text)
        if np_m:
            add('numLawyers', int(np_m.group(1)), np_m.group())

    # Department table scope is essential: never use Composition of the firm.
    for section in re.finditer(r'(?:Composition of (?:the|this) department|Composici[oó]n del departamento)\s*:\s*\n([^\n]+)\n\s*([^\n]+)', text, re.I):
        headers = [x.strip().lower() for x in section.group(1).split('|')]
        cells = [x.strip() for x in section.group(2).split('|')]
        if len(headers) != len(cells):
            continue
        partners = []
        for header, cell in zip(headers, cells):
            if not re.fullmatch(r'\d{1,5}', cell):
                continue
            if re.search(r'partners|socios|socias', header):
                partners.append((header, int(cell)))
            elif re.search(r'counsels?/associates|(?:other |qualified )?lawyers|abogados', header):
                add('numLawyers', int(cell), section.group())
        total = [n for h, n in partners if not re.search(r'\b(?:male|female|hombres|mujeres)\b', h)]
        if len(total) == 1:
            add('numPartners', total[0], section.group())
        elif len(partners) == 2 and all(re.search(r'\b(?:male|female|hombres|mujeres)\b', h) for h, _ in partners):
            # Require both columns; a blank column is unknown, not zero.
            if len({re.sub(r'female|mujeres', 'female', re.sub(r'\bmale\b|hombres', 'male', h)) for h, _ in partners}) == 2:
                add('numPartners', sum(n for _, n in partners), section.group())
    # A closed list in the explicit headcount cell is a countable answer.
    # Never count B9 biographies, key partners or matter teams as a census.
    for key, code in [('numPartners', 'B2'), ('numLawyers', 'B3')]:
        match = re.search(r'^\s*' + code + r'\s+(?:Number|No\.) of [^\n]*\n(.*?)(?=^\s*(?:B\d+\b|\*Please)|\Z)', text, re.I | re.M | re.S)
        if not match:
            continue
        lines = [line.split('|')[0].strip() for line in match.group(1).splitlines()]
        lines = [line for line in lines if line and not re.match(r'Indicate\b|\d+(?:[.,]\d+)?\s*%', line, re.I)]
        if lines and re.fullmatch(r'\d{1,5}', lines[0]):
            add(key, int(lines[0]), match.group())
        elif lines and all(re.fullmatch(r"[^\W\d_]+(?:[ .’'-]+[^\W\d_]+)+\.?", line, re.UNICODE) and not re.search(r'\b(?:including|include|other|others|etc|vacant|unknown|partners|lawyers|not|available|provided|pending|none|confirmar|pendiente)\b', line, re.I) for line in lines):
            add(key, len(set(line.rstrip('.').casefold() for line in lines)), match.group())

    for key, header in [
        ('contacts', r'(?:A4\s+Contact(?:s)?(?: person to arrange| for (?:arranging )?)\s*interviews|Contact details to arrange interviews)[^\n]*'),
        ('departmentHeads', r'(?:B7\s+Head or Heads of department|Head\(s\)\s+of\s+(?:Team|department)|(?:Head|Heads|Name of the Head\(s\))\s+(?:or Heads\s+)?of\s+(?:the\s+)?(?:department|team))[^\n]*')
    ]:
        match = re.search(r'^\s*' + header + r'(?:\n|\Z)', text, re.I | re.M)
        if not match:
            continue
        tail = text[match.end():]
        boundary = re.search(r'^\s*(?:[A-E]\d\b|Number\s+of\s+PARTNERS|Your\s+team|What\s+is\s+the\s+Team)', tail, re.M | re.I)
        block = tail[:boundary.start()] if boundary else tail[:1200]
        people = []
        for line in block.splitlines():
            cells = [x.strip() for x in re.split(r'[|\x07]', line)]
            if len(cells) < 1 or cells[0].lower() in ('name', 'nombre', 'email', 'e-mail', 'telephone number', 'phone', 'telephone', 'job title', 'location', ''):
                continue
            if len(cells[0].split()) < 2:
                continue
            if not re.fullmatch(r"[\wÀ-ÿ .’'-]{3,100}", cells[0]) or any(c.isdigit() for c in cells[0]):
                continue
            from utils.validators import is_valid_person_name
            if not is_valid_person_name(cells[0]):
                continue
            # Legacy Word converters retain HYPERLINK field instructions.
            email = next((m.group() for c in cells[1:] for m in re.finditer(r'(?<![\w@])[^\s@"<>:]+@[^\s@"<>]+\.[^\s@"<>]+', c)), '')
            phone = next((c for c in cells[1:] if re.fullmatch(r'[+\d ()-]{7,30}', c)), '')
            people.append({'name':cells[0], 'email':email, 'phone':phone})
        if people:
            add(key, people, match.group() + block)
    return resolve_filing_fields([{'filing_evidence': findings}])


def resolve_filing_fields(results):
    evidence = {key: [] for key in FIELDS}
    for result in results:
        for key in FIELDS:
            for item in result.get('filing_evidence', {}).get(key, []):
                evidence[key].append({**item, **({'source': result['source']} if result.get('source') else {})})
    values, status = {}, {}
    for key, items in evidence.items():
        def identity(value):
            if isinstance(value, list):
                return str(sorted(json.dumps({field: str(person.get(field) or '').strip() for field in ('name', 'email', 'phone')}, sort_keys=True, ensure_ascii=False).casefold() for person in value))
            return str(value).strip().casefold()
        unique = {identity(item['value']): item['value'] for item in items if item.get('value') is not None}
        status[key] = 'found' if len(unique) == 1 else 'conflicting' if unique else 'not_found'
        if len(unique) == 1:
            values[key] = next(iter(unique.values()))
    return {'filing_details': values, 'filing_evidence': evidence, 'filing_field_status': status}


def merge_model_filing_fields(deterministic, findings, text):
    """Use the existing unstructured extraction call; keep only literal, typed evidence."""
    norm = lambda value: ' '.join(str(value or '').split()).casefold()
    evidence = {key: [] for key in FIELDS}
    for finding in findings:
        key, quote = finding.get('field'), finding.get('source_quote')
        if key not in FIELDS or not norm(quote) or norm(quote) not in norm(text):
            continue
        if key in ('numPartners','numLawyers'):
            value = finding.get('number_value')
            if isinstance(value,bool) or not isinstance(value,int) or not 0 <= value <= 100000:
                continue
        elif key == 'departmentName':
            value = str(finding.get('text_value') or '').strip()
            if not value or norm(value) not in norm(quote):
                continue
        else:
            value = finding.get('people') or []
            if not value or any(not p.get('name') or any(norm(p.get(f)) not in norm(quote) for f in ('name','email','phone') if p.get(f)) for p in value):
                continue
        evidence[key].append({'value': value, 'quote':quote})
    return resolve_filing_fields([deterministic, {'filing_evidence':evidence}])
