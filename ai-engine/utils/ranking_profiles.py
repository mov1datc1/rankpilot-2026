"""Bounded official profile research. Publisher commentary is not firm evidence."""
import hashlib
import html as html_module
import json
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse

import httpx

VERSION = 'official-profile-evidence-v1'


def official_url(path):
    url = urljoin('https://chambers.com/', str(path or ''))
    parsed = urlparse(url)
    if parsed.scheme != 'https' or parsed.hostname not in ('chambers.com', 'www.chambers.com') or parsed.username or parsed.port not in (None,443):
        raise ValueError('Non-official profile URL')
    if not parsed.path.startswith(('/department/', '/lawyer/')):
        raise ValueError('Not an observed department or lawyer profile')
    return url


def fetch_profile(path):
    url = official_url(path)
    with httpx.Client(timeout=20, follow_redirects=False) as client:
        for _ in range(4):
            with client.stream('GET',url) as response:
                if response.is_redirect:
                    url=official_url(urljoin(url,response.headers.get('location','')))
                    continue
                response.raise_for_status()
                chunks=[];size=0
                for chunk in response.iter_bytes():
                    size+=len(chunk)
                    if size>4_000_000:raise ValueError('Profile exceeds bounded size')
                    chunks.append(chunk)
                return b''.join(chunks).decode('utf-8'),url
    raise ValueError('Too many profile redirects')


def bodies(document):
    for script in re.findall(r'<script\b[^>]*>(.*?)</script>',document,re.S|re.I):
        try:state=json.loads(script)
        except (ValueError,TypeError):continue
        if isinstance(state,dict):
            for value in state.values():
                if isinstance(value,dict) and 'b' in value:yield value['b']


def sections(items):
    result=[]
    for section in items or []:
        for part in section.get('content',[]):
            if part.get('locale','en-GB')!='en-GB':continue
            text=' '.join(html_module.unescape(re.sub('<[^>]+>',' ',part.get('body',''))).split())
            if text:result.append({'heading':section.get('heading'),'text':text,'attribution':'Chambers editorial / attributed interview commentary'})
    return result


def parse_profile(document,url,subject,practice,country,edition):
    from utils.ranking_verifier import normalize
    from utils.benchmark_scraper import _normalize_practice_area
    data=list(bodies(document))
    individual=subject.get('kind')=='individual'
    candidates=[b for b in data if isinstance(b,dict) and ('fullName' in b and 'rankings' in b if individual else 'departmentProfileUrl' in b)]
    def scope(item):
        return normalize(_normalize_practice_area(item.get('practiceAreaName','')))==normalize(_normalize_practice_area(practice)) and normalize(item.get('locationName'))==normalize(country)
    matches=[]
    for item in candidates:
        name=item.get('fullName') if individual else item.get('organisationParentName')
        exact=normalize(name)==normalize(subject['name'])
        supplied=set(normalize(subject['name']).split());observed=set(normalize(name).split())
        linked_variant=individual and subject.get('identity_basis')=='source_supplied_official_profile' and min(len(supplied),len(observed))>=2 and (supplied<=observed or observed<=supplied)
        if not exact and not linked_variant:continue
        if individual and normalize(item.get('organisationName'))!=normalize(subject.get('firm')):continue
        rankings=[r for r in item.get('rankings',[]) if scope(r)] if individual else ([item] if scope(item) else [])
        year=item.get('latestPublication',{}).get('year')
        if not rankings or not year or (str(edition).lower()!='current' and str(year)!=str(edition)):continue
        matches.append((item,rankings))
    if len(matches)!=1:return {'status':'scope_or_identity_unresolved','subject':subject,'source_url':url}
    item,rankings=matches[0];publication=item['latestPublication']['id']
    commentary=[]
    for body in data:
        if individual and isinstance(body,list):
            for group in body:
                if not isinstance(group,dict):continue
                for editorial in group.get('personEditorials',[]):
                    if editorial.get('personOrganisationId')==item.get('personOrganisationId') and editorial.get('publicationId')==publication and scope(editorial):commentary.extend(sections(editorial.get('sections')))
        elif not individual and isinstance(body,dict) and body.get('organisationId')==item.get('organisationParentId') and body.get('publicationId')==publication and body.get('practiceAreaId')==item.get('practiceAreaId') and body.get('locationId')==item.get('locationId'):
            commentary.extend(sections(body.get('sections')))
    return {'status':'retrieved' if commentary else 'no_editorial_commentary','subject':subject,
            'source_url':url,'content_sha256':hashlib.sha256(document.encode()).hexdigest(),
            'retrieved_at':datetime.now(timezone.utc).isoformat(),'parser_version':VERSION,
            'practice_area':practice,'jurisdiction':country,'edition':item['latestPublication']['year'],
            'observed_name':item.get('fullName') if individual else item.get('organisationParentName'),
            'observed_band':rankings[0].get('rankDescription') or rankings[0].get('rankName') if individual else (item.get('ranks') or [{}])[0].get('rankName'),
            'commentary':commentary,'limitations':['Profile observations are external context, not evidence of work in the uploaded submission. Years ranked do not establish historical band movement. Firm-provided biographies are excluded.']}


def research_profiles(subjects,practice,country,edition):
    def read(subject):
        try:
            document,url=fetch_profile(subject.get('profile_path'))
            return parse_profile(document,url,subject,practice,country,edition)
        except Exception:
            return {'status':'unavailable','subject':subject,'limitations':['Official profile could not be retrieved or verified. Do not infer absence of ranking or reputation.']}
    # Each observed URL is fetched once; explicit cap prevents runaway research.
    unique={s.get('profile_path'):s for s in subjects if s.get('profile_path')}
    selected=list(unique.values())[:24]
    with ThreadPoolExecutor(max_workers=3) as executor:results=list(executor.map(read,selected))
    return {'version':VERSION,'profiles':results,'requested':len(unique),'attempted':len(selected),
            'limitations':['Historical band movement has not been independently retrieved.']+(['Profile research cap reached; remaining subjects are not verified.'] if len(unique)>24 else [])}
