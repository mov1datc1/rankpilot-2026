"""Keep explicitly reported narrative financial evidence separate from legal matter values.

This detects an omission, not a financial meaning or permission to publish it.
Only source-grounded, confidential source narratives are in scope.
"""
import re
from decimal import Decimal

MONEY=re.compile(r'(?<!\w)(?P<currency>USD|US\$|MXN|EUR|GBP)\s*(?P<number>\d+(?:,\d{3})*(?:\.\d+)?)(?:\s*(?P<unit>billion|million|bn|b|mn|m|miles?\s+de\s+millones|millones?))?\b(?![.,]\d)',re.I)
FINANCIAL_CONTEXT=re.compile(r'\b(?:projects?|pipelines?|construction|metro|claims?|exposure|judg(?:e)?ments?|awards?|settlements?|liabilit(?:y|ies)|compensation|proyectos?|construcci[oó]n|exposici[oó]n|reclamaciones?|condena|sentencia)\b',re.I)

def amounts(text):
    found=[]
    for match in MONEY.finditer(str(text or '')):
        unit=(match.group('unit') or '').lower()
        scale=Decimal(10)**(9 if unit in ('billion','bn','b','mil de millones','miles de millones') else 6 if unit else 0)
        found.append((match.group('currency').upper().replace('US$','USD'),Decimal(match.group('number').replace(',',''))*scale))
    return set(found)

def contextual_amounts(matter):
    # Public prose has separate privacy/permission rules. Never require a
    # restricted metric to be repeated in B9/B10/C2 or public section D.
    if matter.get('publication_route')!='E':return set()
    source=str(matter.get('rawNotes') or matter.get('source_excerpt') or matter.get('summary') or '')
    result=set()
    for paragraph in re.split(r'\n\s*\n|\n',source):
        if FINANCIAL_CONTEXT.search(paragraph):result.update(amounts(paragraph))
    return result

def missing_contextual_amounts(matter,text):
    return contextual_amounts(matter)-amounts(text)
