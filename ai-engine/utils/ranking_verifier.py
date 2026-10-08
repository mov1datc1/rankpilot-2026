"""Evidence-based firm ranking verification. No fuzzy identity or inferred absence."""
import re
import json
import hashlib
import copy
import unicodedata
from datetime import datetime, timezone, timedelta
from urllib.parse import urlparse
from utils.benchmark_scraper import scrape_rankings, _normalize_practice_area


def normalize(value):
    text = unicodedata.normalize('NFKD', str(value or '')).casefold()
    text = ''.join(c for c in text if not unicodedata.combining(c)).replace('&', ' and ')
    return ' '.join(re.sub(r'[^a-z0-9]+', ' ', text).split())


def compare_claim(firm, directory, practice, jurisdiction, claimed_band, edition, benchmark):
    result = {'status':'unavailable', 'declared_band':claimed_band or None,
              'requested_edition':str(edition or ''), 'firm_name':firm, 'directory':directory,
              'practice_area':practice, 'jurisdiction':jurisdiction, 'observed_band':None,
              'checked_at':datetime.now(timezone.utc).isoformat(),
              'message':'No se pudo verificar el ranking en una fuente oficial; no significa que la firma no esté rankeada.'}
    if not benchmark:
        return result
    result['evidence'] = {key:benchmark.get(key) for key in ('source_url','content_sha256','scraped_at','edition','guide','observed_practice','observed_jurisdiction','parser_version')}
    expected_source = 'chambers' if 'chambers' in directory.lower() else 'legal500' if '500' in directory else None
    host = urlparse(benchmark.get('source_url') or '').hostname
    if not expected_source or benchmark.get('source') != expected_source or host not in {expected_source+'.com','www.'+expected_source+'.com'} or not benchmark.get('content_sha256') or benchmark.get('parser_version') != 'ranking-evidence-v1':
        return result
    try:
        fetched = datetime.fromisoformat(benchmark['scraped_at'].replace('Z','+00:00'))
        age = datetime.now(timezone.utc) - fetched
        if not timedelta(0) <= age <= timedelta(days=1):
            result.update(status='stale',message='La evidencia de ranking está vencida; hay que volver a consultar la fuente oficial.')
            return result
    except (KeyError, ValueError, TypeError):
        return result
    if normalize(_normalize_practice_area(benchmark.get('observed_practice') or '')) != normalize(_normalize_practice_area(practice)) or normalize(benchmark.get('observed_jurisdiction')) != normalize(jurisdiction):
        result.update(status='scope_mismatch',message='La página no acredita la práctica y el país solicitados.')
        return result
    matches = [f for f in benchmark.get('firms',[]) if normalize(f.get('name')) == normalize(firm) and normalize(firm)]
    if not matches:
        result.update(status='not_found',message='No se encontró una coincidencia exacta de la firma en esta tabla. Revisar identidad y alcance; no se ha acreditado que esté sin ranking.')
        return result
    if len(matches) != 1:
        result.update(status='ambiguous',message='Hay más de una coincidencia; se necesita resolver la identidad de la firma.')
        return result
    match = matches[0]
    result.update(observed_band=match.get('band'), matched_firm=match.get('name'))
    result['evidence'].update(profile_path=match.get('profile_path'), organisation_id=match.get('organisation_id'))
    current_table = str(edition).lower() == 'current'
    result['comparison_scope'] = 'current_table_as_of_retrieval' if current_table else 'named_edition'
    if not current_table and (not benchmark.get('edition') or not edition):
        result.update(status='edition_required',message='Se observó una posición en la tabla, pero falta acreditar la edición o indicar cuál se desea comparar.')
        return result
    if not current_table and str(edition) != str(benchmark['edition']):
        result.update(status='edition_mismatch',message='La edición encontrada no coincide con la declarada; no se comparan como si fueran el mismo ranking.')
        return result
    if not claimed_band:
        result.update(status='verified_observation',message='Posición oficial observada para esta firma, práctica, país y edición; no había una banda declarada para comparar.')
    elif normalize(claimed_band) == normalize(match.get('band')):
        result.update(status='verified_match',message='La posición declarada coincide con la tabla oficial para esta edición, práctica y país.')
    else:
        result.update(status='verified_mismatch',message=f"Discrepancia: se declaró {claimed_band}, pero la tabla oficial muestra {match.get('band')} para esta edición, práctica y país.")
    if current_table:
        result['message'] += ' Comparación limitada a la tabla pública consultada en la fecha indicada; no acredita una edición histórica.'
    return result


def compare_individual_claim(lawyer, firm, directory, practice, jurisdiction, edition, benchmark):
    """Individual identity + employer + scope. A department band is never reused."""
    name = lawyer.get('name') or lawyer.get('fullName') or ''
    claimed = lawyer.get('current_ranking') or lawyer.get('currentRanking')
    candidates = [item for item in (benchmark or {}).get('individuals', [])
                  if normalize(item.get('name')) == normalize(name) and normalize(name)
                  and normalize(item.get('firm')) == normalize(firm) and normalize(firm)]
    individual_benchmark = None
    if benchmark:
        editions = {str(item['edition']) for item in candidates if item.get('edition')}
        individual_benchmark = {**benchmark,
            'edition': next(iter(editions)) if len(editions) == 1 else None,
            'firms': [{**item, 'organisation_id': None} for item in candidates]}
    result = compare_claim(name, directory, practice, jurisdiction, claimed, edition, individual_benchmark)
    result['lawyer_name'] = name
    result['firm_name'] = firm
    result['subject_type'] = 'individual'
    if result['status'] == 'not_found':
        result['message'] = 'No se verificó una coincidencia exacta de persona y firma en esta tabla. No acredita ausencia de ranking en otras prácticas o ediciones.'
    elif result['status'].startswith('verified'):
        result['message'] = 'Observación individual limitada a la persona, firma, práctica, país y edición indicados. No acredita una banda del departamento ni de otra práctica.'
    return result


def research_scope(package):
    fields={k:package.get(k) for k in ('firm_name','directory','practice_area','ranking_jurisdiction','jurisdiction','current_band','ranking_edition')}
    fields['lawyers']=[{k:l.get(k) for k in ('name','fullName','current_ranking','currentRanking','url')} for l in package.get('lawyers',[])]
    return hashlib.sha256(json.dumps(fields,sort_keys=True,ensure_ascii=False).encode()).hexdigest()


def verify_ranking_claim(package, previous=None):
    from utils.ranking_profiles import research_profiles, VERSION
    scope_key=research_scope(package)
    if previous and previous.get('research_scope')==scope_key and previous.get('profile_research',{}).get('version')==VERSION:
        try:
            age=datetime.now(timezone.utc)-datetime.fromisoformat(previous['checked_at'])
            if timedelta(0)<=age<timedelta(days=1):
                reused=copy.deepcopy(previous);reused['research_execution']='reused_current_scoped_snapshot';return reused
        except (KeyError,ValueError,TypeError):pass
    args = (package.get('firm_name',''), package.get('directory',''), package.get('practice_area',''),
            package.get('ranking_jurisdiction') or package.get('jurisdiction',''),
            package.get('current_band'), package.get('ranking_edition'))
    try:
        benchmark = scrape_rankings(args[1],args[2],args[3],ttl_days=1)
    except Exception:
        benchmark = None
    result = compare_claim(*args, benchmark)
    # Reuse the same downloaded table for every candidate; no extra model/search
    # request per person and no speculative worldwide ranking inference.
    # A newcomer need not have its own ranking to research the scoped market.
    firms=(benchmark or {}).get('firms',[])
    table_probe=compare_claim(firms[0].get('name',''),args[1],args[2],args[3],None,args[5],benchmark) if firms else {}
    result['table_scope_verified']=table_probe.get('status','').startswith('verified')
    result['market_context'] = market_context(result, benchmark)
    result['individuals'] = [compare_individual_claim(lawyer, args[0], args[1], args[2], args[3], args[5], benchmark)
                             for lawyer in package.get('lawyers', [])]
    subjects=[]
    own=next((f for f in firms if normalize(f.get('name'))==normalize(args[0])),None)
    if result.get('table_scope_verified'):
        if own and own.get('profile_path'):subjects.append({**own,'kind':'firm'})
        peers=[f for f in firms if normalize(f.get('name'))!=normalize(args[0])]
        def band_number(value):
            match=re.search(r'\d+',str(value or ''))
            return int(match.group()) if match else 99
        target=band_number((own or {}).get('band') or package.get('requested_target') or package.get('target_band'))
        peers.sort(key=lambda f:abs(band_number(f.get('band'))-target))
        subjects.extend({**f,'kind':'competitor'} for f in peers[:3] if f.get('profile_path'))
    for person in result['individuals']:
        if person['status'].startswith('verified') and person.get('evidence',{}).get('profile_path'):
            subjects.append({'name':person['lawyer_name'],'firm':args[0],'kind':'individual','profile_path':person['evidence']['profile_path']})
    for lawyer in package.get('lawyers',[]):
        url=lawyer.get('url','')
        if url and not any(s.get('kind')=='individual' and normalize(s.get('name'))==normalize(lawyer.get('name') or lawyer.get('fullName')) for s in subjects):
            from utils.ranking_profiles import official_url
            try:path=official_url(url)
            except ValueError:continue
            subjects.append({'name':lawyer.get('name') or lawyer.get('fullName'),'firm':args[0],'kind':'individual','profile_path':path,'identity_basis':'source_supplied_official_profile'})
    result['profile_research']=research_profiles(subjects,args[2],args[3],args[5])
    for person in result['individuals']:
        profile=next((p for p in result['profile_research'].get('profiles',[]) if p.get('subject',{}).get('kind')=='individual' and p['subject']['name']==person['lawyer_name'] and p.get('status') in ('retrieved','no_editorial_commentary') and p.get('observed_band')),None)
        if profile and not person['status'].startswith('verified'):
            declared=person.get('declared_band')
            status='verified_observation' if not declared or normalize(declared)=='ranked' else 'verified_match' if normalize(declared)==normalize(profile['observed_band']) else 'verified_mismatch'
            person.update(status=status,observed_band=profile['observed_band'],evidence={k:profile.get(k) for k in ('source_url','content_sha256','retrieved_at','edition','practice_area','jurisdiction','parser_version','observed_name')},message='Observación individual del perfil oficial vinculado en la fuente, con identidad, firma, práctica, país y edición reconciliados.')
    result.update(research_scope=scope_key,research_execution='retrieved_table_and_profiles')
    return result


def market_context(verification, benchmark):
    """Expose verified table evidence; no fabricated profiles, trajectory or gaps."""
    valid = verification.get('status', '').startswith('verified') or verification.get('table_scope_verified') is True
    if not valid:
        return {'status': 'unavailable', 'competitors': [], 'limitations': ['No matched, current, scoped table observation for this firm. Do not claim market calibration.']}
    firms = (benchmark or {}).get('firms', [])
    return {'status': 'table_only', 'source': verification.get('evidence'),
            'competitors': [{'name': f.get('name'), 'band': f.get('band'), 'profile_path': f.get('profile_path')}
                            for f in firms if normalize(f.get('name')) != normalize(verification.get('firm_name'))],
            'limitations': ['Table positions only; profile commentary, historical trajectory and evidence-based competitor gap analysis have not been retrieved. Do not claim full market calibration.']}
