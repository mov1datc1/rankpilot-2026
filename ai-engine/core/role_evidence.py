"""A form's Lead partner heading is not a biographical promotion."""
import re
import unicodedata


def identity(value):
    value = unicodedata.normalize('NFKD', str(value or '')).casefold()
    return ' '.join(re.findall(r'\w+', ''.join(c for c in value if not unicodedata.combining(c))))


def matter_names_person(name, matter):
    target = identity(name)
    source = ' '.join(identity(matter.get(k)) for k in ('leadPartner','lead_partner','teamMembers','team_members','source_excerpt','rawNotes','summary'))
    return bool(target and re.search(r'(?<!\w)'+re.escape(target)+r'(?!\w)', source))


def role_heading_is_not_promotion(defect, package):
    if defect.get('field_path') != 'role' or defect.get('scope') not in ('submission','letter'):
        return False
    matter = next((m for m in package.get('matters', []) if m.get('id')==defect.get('matter_id')), {})
    name = str(matter.get('leadPartner') or matter.get('lead_partner') or '').strip()
    if not name or any(identity(p.get('name') or p.get('fullName'))==identity(name) for p in package.get('lawyers', [])):
        return False
    source = str(matter.get('source_excerpt') or '')
    # Exact standard field, exact person, in this matter; no factual title claim.
    heading = re.search(r'(?m)^\s*[DE]5\s+Lead partner\s*\n\s*'+re.escape(name)+r'\s*(?=\n|$)', source, re.I)
    if not heading:
        return False
    bio = str(package.get('b10_source') or '')
    associates = re.search(r'\bassociate attorneys\s*[, :]\s*([^.!?]+)', bio, re.I)
    if not associates or identity(name) not in identity(associates.group(1)):
        return False
    quote = str(defect.get('source_quote') or '')
    # Both alleged alternatives must really be cited, not a loose similarity.
    if identity(name) not in identity(quote) or 'associate attorneys' not in quote.casefold() or not re.search(r'\b[DE]5\s+Lead partner\b', quote, re.I):
        return False
    prefix = re.split(r'\b[DE]5\s+Lead partner\b', quote, flags=re.I)[0].strip()
    if not prefix or identity(prefix) not in identity(bio):
        return False
    claim = ' '.join(str(defect.get('artifact_quote') or '').split())
    rendered = ' '.join(str(package.get('rendered_artifact' if defect['scope']=='submission' else 'rendered_audit') or '').split())
    return bool(claim and claim in rendered)


def role_names_person_exactly(name, value):
    """A structured role listing is not authority for a shorter-name alias."""
    if isinstance(value,(list,tuple)):
        return any(role_names_person_exactly(name,item) for item in value)
    target=identity(name)
    parts=re.split(r'[,;/&\n]|\b(?:and|y)\b',str(value or ''),flags=re.I)
    return bool(target) and any(identity(part)==target for part in parts)


def team_listing_quote(name, quote, matter):
    """Recognise literal participation evidence, not an individual achievement.

    This checks original structured team fields, not a model's role label.
    A narrative passage or lead-role quotation is not exempted.
    """
    def without_heading(value):
        return re.sub(r'^\s*(?:other\s+)?team\s+members?\s*:\s*','',str(value or ''),flags=re.I)
    value=identity(without_heading(quote));target=identity(name)
    if not value or not target:return False
    for key in ('teamMembers','team_members'):
        listing=without_heading(matter.get(key))
        team=identity(listing)
        if team and (value==team or value==target) and role_names_person_exactly(name,listing):
            return True
    return False
