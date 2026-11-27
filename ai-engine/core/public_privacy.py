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

# A single case metric can identify a mandate when its transaction, procedure
# or sensitive investigation is also described. These tags locate a privacy
# transformation; they never establish client identity or a legal outcome.
CASE_CONTEXT = {
    'acquisition':r'\b(?:acquisition|post[- ]acquisition|adquisici[oó]n)\b',
    'constitutional_proceeding':r'\b(?:amparo|constitutional (?:litigation|proceedings?|challenge|relief))\b',
    'investigation':r'\b(?:internal (?:employment )?investigation|investigaci[oó]n interna)\b',
    'judgment':r'\b(?:adverse (?:labou?r )?judgments?|sentencias? adversas?)\b',
    'litigation':r'\b(?:litigation|litigios?|labou?r disputes?|employment disputes?)\b',
    'restructuring':r'\b(?:restructuring|employer[- ]substitution|reestructuraci[oó]n)\b',
}


def case_context(text):
    return {key for key,pattern in CASE_CONTEXT.items() if re.search(pattern,str(text or ''),re.I)}


def money_currencies(text):
    result={}
    for match in MONEY.finditer(str(text or '')):
        if not match['currency']:continue
        number=_number(match['number'])
        if number is None:continue
        number*=MAGNITUDES.get(str(match['magnitude']).casefold(),1)
        currency=match['currency'].upper()
        currency={'US$':'USD','€':'EUR','£':'GBP'}.get(currency,currency)
        result.setdefault(('amount',str(number.normalize())),set()).add(currency)
    return result

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

SOURCE_KEYS = ('source_excerpt','rawNotes','summary','notes','description','value','completionDate','otherInfo')


def is_private_matter(matter):
    return (matter.get('publication_route')=='E' or matter.get('resolved_publication_status') in ('confidential','confirmation_required')
            or matter.get('publish_status') in ('confidential','non_publishable','confirmation_required'))


def metric_spans(text):
    """Literal spans of the same metrics metric_facts() detects, in source order."""
    text=str(text or '');spans=[]
    for match in MONEY.finditer(text):
        if match['currency'] or match['magnitude']:spans.append((match.start(),match.end()))
    spans+=[(m.start(),m.end()) for m in re.finditer(r'(?<!\w)'+NUMBER+r'\s*%',text)]
    for match in COUNT.finditer(text):
        number=_number(match['number'])
        if number is not None and number>=2 and not any(a<=match.start()<b for a,b in spans):
            spans.append((match.start(),match.end()))
    result=[]
    for a,b in sorted(spans):
        value=' '.join(text[a:b].split())
        if value and value not in result:result.append(value)
    return result


# Business families used only to notice that the client register and the
# matter narrative describe a client's business differently (v1.0.102).
SECTOR_FAMILIES = {
    'manufacturing': r'manufactur|fabric|automotive|auto ?parts|industrial|maker|producer|plant|metal',
    'logistics': r'logistic|supply chain|supply &|supply and|transport|distribution|freight|warehous',
    'retail': r'retail|store|supermarket|tiendas?',
    'finance': r'bank|financ|insur|leasing|credit',
    'energy': r'energy|oil|gas|power|electric|solar|petrol',
    'telecom': r'telecom|cable|broadband|internet|mobile',
    'entertainment': r'cinema|entertainment|film|media|radio',
    'hospitality': r'hotel|hospitality|restaurant|tourism',
    'security': r'security services|guard|seguridad privada',
    'education': r'educat|school|universit|escuela',
    'technology': r'technolog|software|digital platform',
    'real_estate': r'real estate|property develop|inmobiliari',
}


def register_sector(matter):
    """Sector column of this matter's own client-register row, when present."""
    rows=((matter.get('confidentialityEvidence') or {}).get('client_register') or [])
    for row in rows:
        cells=[c.strip() for c in str(row.get('quote') or '').split('|')]
        if len(cells)>=2 and cells[1] and not re.fullmatch(r'[YN]|N/?A|-',cells[1],re.I):
            return cells[1]
    return ''


def _families(text):
    return {k for k,p in SECTOR_FAMILIES.items() if re.search(r'\b(?:'+p+')',str(text or ''),re.I)}


def sector_rule(matter):
    """How a public section may describe this client's business."""
    sector=register_sector(matter)
    if not sector:return None
    narrative='\n'.join(str(matter.get(k) or '') for k in ('summary','rawNotes','description'))
    registered,described=_families(sector),_families(narrative)
    if registered and described and not registered & described:
        return {'register_sector':sector,'disputed':True,
                'rule':'The client register and the matter narrative describe this business differently: give no sector or industry label for this client; write "a confidential client".'}
    return {'register_sector':sector,'disputed':False,
            'rule':'Any sector label for this client must agree with the register sector.'}


def public_disclosure(package, matter_ids):
    """Public view of each confidential mandate for the B9/B10/C2 writers (v1.0.101).

    Depth with results and the confidential-metric rule collided: the writer
    received the full matter and was then rejected for printing its figures.
    The writer now receives, before prose, the names and exact figures that
    must stay out of public sections. The source and section E are untouched;
    public_privacy_findings() remains the postcondition.
    """
    from core.client_identity import client_aliases, register_names
    view=[]
    for matter in package.get('matters',[]):
        if matter.get('id') not in matter_ids or not is_private_matter(matter):continue
        source='\n'.join(str(matter.get(k) or '') for k in SOURCE_KEYS)
        entry={'matter_id':matter['id'],'client_names_not_public':client_aliases(register_names(matter)[:1]),
               'figures_not_public':metric_spans(source),
               'public_rule':'Describe this mandate as work for a confidential client; give a non-monetary scale qualitatively and a monetary amount no size at all (no "substantial", "significant" or "multi-million"). Legal problem, action, role and result stay.'}
        sector=sector_rule(matter)
        if sector:entry['client_sector']=sector
        view.append(entry)
    return view


def public_privacy_findings(package, strategy, proposal):
    fields={p:proposal.get(p,'') for p in ('b10','c2')}
    fields.update({f'candidates/{i}/submission_bio':c.get('submission_bio','')
                   for i,c in enumerate(proposal.get('candidates',[]))})
    core={d['matter_id'] for d in strategy.get('matters',[]) if d.get('disposition')=='core'}
    # Personal evidence can also come from a pertinent reserve. Its public
    # quantitative footprint needs exactly the same privacy postcondition.
    tracked=core | {s.get('matter_id') for c in proposal.get('candidates',[]) for s in c.get('supporting_matters',[])}
    result=[]
    for matter in package.get('matters',[]):
        if matter.get('id') not in tracked:continue
        if not (matter.get('publication_route')=='E' or matter.get('resolved_publication_status') in ('confidential','confirmation_required')
                or matter.get('publish_status') in ('confidential','non_publishable','confirmation_required')):continue
        source='\n'.join(str(matter.get(k) or '') for k in ('source_excerpt','rawNotes','summary','notes','description','value','completionDate','otherInfo'))
        facts=metric_facts(source)
        for path,value in fields.items():
            shared=facts & metric_facts(value)
            source_money,public_money=money_currencies(source),money_currencies(value)
            # Equal numerals in explicitly different currencies are not the
            # same confidential metric. '$' remains ambiguous, never USD proof.
            shared={fact for fact in shared if not (fact[0]=='amount'
                    and source_money.get(fact) and public_money.get(fact)
                    and '$' not in source_money[fact] | public_money[fact]
                    and not source_money[fact] & public_money[fact])}
            context=case_context(source) & case_context(value)
            linked=False
            if path.startswith('candidates/'):
                candidate=proposal['candidates'][int(path.split('/')[1])]
                linked=any(s.get('matter_id')==matter['id'] for s in candidate.get('supporting_matters',[]))
            if len(shared)<2 and not (shared and (context or linked)):continue
            result.append({'matter_id':matter['id'],'path':path,'metrics':sorted(shared),
                           'case_context':sorted(context),'candidate_source_link':linked})
    return result
