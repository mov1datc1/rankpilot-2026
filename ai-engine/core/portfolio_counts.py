"""Bind an alleged portfolio-count defect to the actual canonical selection."""
import re

NUMBERS = dict(zip(('one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty').split(), range(1,21)))
NUMBERS.update(zip(('uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciseis diecisiete dieciocho diecinueve veinte').split(), range(1,21)))

def enumeration_defects(strategy,letter,require_numbered=False):
    """A reserve note cannot become an extra numbered selected-portfolio row."""
    text=str(letter.get('portfolio') or '')
    entries=list(re.finditer(r'(?m)^\s*(\d{1,2})[.)]\s+(.+)$',text))
    if not entries and not require_numbered:return []
    count=sum(d.get('disposition')=='core' for d in strategy.get('matters',[]))
    if [int(m.group(1)) for m in entries]==list(range(1,count+1)):return []
    quote=re.sub(r'[*_`]', '',entries[-1].group().strip()) if entries else text.strip()
    return [{'code':'SELECTION_MISMATCH','severity':'critical','scope':'letter','owner':'rankpilot',
        'field_path':'portfolio','matter_id':None,'source_quote':'','artifact_quote':quote,
        'message':f'La enumeración del núcleo debe contener exactamente {count} entradas consecutivas, del 1 al {count}. Retira notas de reserva o placeholders de esa lista; conserva cada asunto seleccionado, su orden y su contribución.'}]


def wrong_generated_count(defect, package, strategy):
    if defect.get('code')!='UNSUPPORTED_CLAIM' or defect.get('field_path')!='selected_matter_count' or defect.get('scope')!='letter':
        return False
    quote=' '.join(str(defect.get('artifact_quote') or '').split())
    rendered=' '.join(str(package.get('rendered_audit') or '').split())
    if not quote or quote not in rendered:
        return False
    count=len([d for d in strategy.get('matters',[]) if d.get('disposition')=='core'])
    words='|'.join(NUMBERS)
    match=re.search(r'\b(?:n[uú]cleo|core|portfolio|portafolio|cartera)[^.:\n]{0,65}?\b(\d+|'+words+r')\s+(?:asuntos|matters)\b',quote,re.I)
    if not match or not count:
        return False
    value=match.group(1).casefold()
    return (int(value) if value.isdigit() else NUMBERS[value]) != count


def rendered_count_defects(package, strategy, letter):
    rendered=' '.join(str(package.get('rendered_audit') or '').split())
    count=sum(d.get('disposition')=='core' for d in strategy.get('matters',[]))
    if not rendered or not count:
        return []
    words='|'.join(NUMBERS)
    pattern=re.compile(r'\b(?:n[uú]cleo(?:\s+seleccionado)?\s+(?:de|contiene|comprende)|cartera\s+central(?:\s+recomendada)?\s+de|selected\s+portfolio\s+(?:of|contains|comprises)|core\s+portfolio\s+(?:of|contains|comprises))\s+(\d+|'+words+r')\s+(?:asuntos|matters)\b',re.I)
    defects=[d for d in enumeration_defects(strategy,letter)
             if ' '.join(d['artifact_quote'].split()) in rendered]
    for field in ('portfolio','executive_assessment'):
        text=' '.join(str(letter.get(field) or '').split())
        for match in pattern.finditer(text):
            raw=match.group(1).casefold();value=int(raw) if raw.isdigit() else NUMBERS[raw]
            if value!=count and match.group() in rendered:
                defects.append({'code':'SELECTION_MISMATCH','severity':'critical','scope':'letter',
                    'field_path':field,'matter_id':None,'source_quote':'','artifact_quote':match.group(),
                    'message':f'El total escrito en el Audit no coincide con los {count} asuntos core de la selección canónica. Corrige únicamente el total y su enumeración; conserva selección, orden y fuentes.'})
    return defects
