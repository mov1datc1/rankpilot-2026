"""Batch public identifying metric combinations before Word generation.

This conservative preflight locates generated prose to generalize. It never
edits source facts, confidential narratives, publication permission or approval.
The independent semantic and exact-document review remain mandatory.
"""
import re
from decimal import Decimal, InvalidOperation

NUMBER = r'\d+(?:[.,]\d+)*'
WORDS = {'two':2,'three':3,'four':4,'five':5,'six':6,'seven':7,'eight':8,'nine':9,'ten':10,
         'dos':2,'tres':3,'cuatro':4,'cinco':5,'seis':6,'siete':7,'ocho':8,'nueve':9,'diez':10}
MAGNITUDES = {'million':1000000,'millions':1000000,'millones':1000000,
              'billion':1000000000,'billions':1000000000}
MONEY = re.compile(r'(?<!\w)(?:(?P<currency>US\$|USD|MXN|EUR|GBP|[$€£])\s*)?'
                   r'(?P<number>'+NUMBER+r')\s*(?P<magnitude>millions?|millones|billions?)?(?!\w)',re.I)
COUNT = re.compile(r'(?<!\w)(?P<number>'+NUMBER+'|'+'|'.join(WORDS)+r')\s+'
                   r'(?:(?:active|labour|labor|Mexican|ongoing|activos?|laborales?|mexicanos?)\s+){0,3}'
                   r'(?P<unit>employees|workers|empleados|trabajadores|states|estados|proceedings|disputes|claims|litigios|procedimientos|companies|empresas|facilities|plantas|inspections|inspecciones|hectares|hectáreas)\b',re.I)

def _number(value):
    value=value.casefold()
    if value in WORDS:
        return Decimal(WORDS[value])
    # Comma groups are thousands; decimal comma is accepted when unambiguous.
    if re.fullmatch(r'\d{1,3}(?:,\d{3})+(?:\.\d+)?',value):
        value=value.replace(',','')
    elif re.fullmatch(r'\d{1,3}(?:\.\d{3})+(?:,\d+)?',value):
        value=value.replace('.','').replace(',','.')
    elif ',' in value and '.' not in value:
        value=value.replace(',','.')
    try:return Decimal(value)
    except InvalidOperation:return None

def metric_facts(text):
    """Return explicit operational counts, money/scales and percentages only.

    Bare dates, statutory citations and ordinary numbers are not identifiers.
    Numeric matching locates a privacy risk, not a finding of factual identity.
    """
    text=str(text or '');facts=set();money_spans=[]
    for match in MONEY.finditer(text):
        if not match['currency'] and not match['magnitude']:continue
        number=_number(match['number'])
        if number is None:continue
        number*=MAGNITUDES.get(str(match['magnitude']).casefold(),1)
        facts.add(('amount',str(number.normalize())));money_spans.append(match.span())
    for match in re.finditer(r'(?<!\w)('+NUMBER+r')\s*%',text):
        number=_number(match[1])
        if number is not None:facts.add(('percent',str(number.normalize())))
    for match in COUNT.finditer(text):
        if any(a<=match.start()<b for a,b in money_spans):continue
        number=_number(match['number'])
        if number is None or number<2:continue
        unit=match['unit'].casefold()
        family=next((name for name,units in {
            'workforce':('employees','workers','empleados','trabajadores'),
            'geography':('states','estados'),
            'proceedings':('proceedings','disputes','claims','litigios','procedimientos'),
            'entities':('companies','empresas'), 'facilities':('facilities','plantas'),
            'inspections':('inspections','inspecciones'), 'area':('hectares','hectáreas')
        }.items() if unit in units),unit)
        facts.add((family,str(number.normalize())))
    return facts

def public_privacy_findings(package, strategy, proposal):
    fields={p:proposal.get(p,'') for p in ('b10','c2')}
    fields.update({f'candidates/{i}/submission_bio':c.get('submission_bio','')
                   for i,c in enumerate(proposal.get('candidates',[]))})
    core={d['matter_id'] for d in strategy.get('matters',[]) if d.get('disposition')=='core'}
    result=[]
    for matter in package.get('matters',[]):
        if matter.get('id') not in core:continue
        if not (matter.get('publication_route')=='E' or matter.get('resolved_publication_status') in ('confidential','confirmation_required')
                or matter.get('publish_status') in ('confidential','non_publishable','confirmation_required')):continue
        source='\n'.join(str(matter.get(k) or '') for k in ('source_excerpt','rawNotes','summary','value','completionDate','otherInfo'))
        facts=metric_facts(source)
        for path,value in fields.items():
            shared=facts & metric_facts(value)
            if len(shared)<2:continue
            result.append({'matter_id':matter['id'],'path':path,'metrics':sorted(shared)})
    return result
