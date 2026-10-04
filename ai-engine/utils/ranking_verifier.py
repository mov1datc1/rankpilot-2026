"""Evidence-based firm ranking verification. No fuzzy identity or inferred absence."""
import re
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


def verify_ranking_claim(package):
    args = (package.get('firm_name',''), package.get('directory',''), package.get('practice_area',''),
            package.get('ranking_jurisdiction') or package.get('jurisdiction',''),
            package.get('current_band'), package.get('ranking_edition'))
    try:
        benchmark = scrape_rankings(args[1],args[2],args[3],ttl_days=1)
    except Exception:
        benchmark = None
    return compare_claim(*args, benchmark)
