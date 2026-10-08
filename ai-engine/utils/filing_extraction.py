"""Source-backed administrative fields, kept separate from firm-wide totals.

Missing and conflicting values are not zero. Evidence survives multi-file ingestion.
"""
import re

FIELDS = ('departmentName', 'numPartners', 'numLawyers', 'contacts', 'departmentHeads')


def extract_filing_fields(text):
    findings = {key: [] for key in FIELDS}

    def add(key, value, quote):
        findings[key].append({'value': value, 'quote': quote.strip()})

    # Explicit Chambers fields, including inline and table-flattened answers.
    labels = {
        'departmentName': r'(?:B1\s+)?Department name(?:\s*\(used by firm\))?',
        'numPartners': r'B2\s+(?:Number of partners|No\.? of partners)',
        'numLawyers': r'B3\s+(?:Number of (?:other )?(?:qualified )?lawyers|No\.? of lawyers)',
    }
    for key, label in labels.items():
        value = r'([^\n|]{1,100})' if key == 'departmentName' else r'(\d{1,5})'
        for match in re.finditer(r'^\s*' + label + r'[ \t:|]*\n?\s*' + value + r'[ \t]*(?=\n|\||$)', text, re.I | re.M):
            answer = match.group(1).strip()
            if key == 'departmentName' and (re.match(r'B\d\b', answer) or answer.lower() in ('n/a', 'not provided')):
                continue
            add(key, answer if key == 'departmentName' else int(answer), match.group())

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
    for key, header in [('contacts', r'A4\s+Contact(?:s)? for (?:arranging )?interviews[^\n]*'), ('departmentHeads', r'B7\s+Head or Heads of department[^\n]*')]:
        match = re.search(r'^\s*' + header + r'\n', text, re.I | re.M)
        if not match:
            continue
        tail = text[match.end():]
        boundary = re.search(r'^\s*[A-E]\d+\b', tail, re.M)
        block = tail[:boundary.start()] if boundary else tail[:1200]
        people = []
        for line in block.splitlines():
            cells = [x.strip() for x in line.split('|')]
            if len(cells) < 2 or cells[0].lower() in ('name', 'nombre', ''):
                continue
            if not re.fullmatch(r"[\wÀ-ÿ .’'-]{3,100}", cells[0]) or any(c.isdigit() for c in cells[0]):
                continue
            email = next((c for c in cells[1:] if re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', c)), '')
            phone = next((c for c in cells[1:] if re.fullmatch(r'\+?[\d ()-]{7,30}', c)), '')
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
        unique = {str(item['value']).strip().casefold(): item['value'] for item in items}
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
