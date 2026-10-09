"""Bind the final review's register/narrative comparison to original evidence."""
import re
from pydantic import BaseModel, Field
from typing import Literal

class RegisterClaim(BaseModel):
    scope: Literal['submission','letter']
    artifact_quote: str
    conflicting_artifact_term: str

class RegisterCheck(BaseModel):
    matter_id: str
    relationship: Literal['consistent','conflicting','not_comparable']
    rationale: str = Field(description='Compare the client industry in its original register row with the SAME client in the matter narrative. Service descriptions are not client industries. Explain compatible broader/narrower descriptions rather than inventing a conflict.')
    register_quote: str = ''
    narrative_quote: str = ''
    nonessential_sector: bool = Field(default=False,description='True only if withdrawing an optional industry descriptor preserves all legally significant facts, scale, roles and selection. Never use for identity, amounts, outcomes or permissions.')
    claims: list[RegisterClaim] = Field(default_factory=list,description='For a conflicting sector ONLY: all remaining assertions in the exact Submission or Audit, each with its literal disputed sector term. Empty when already neutralized. Do not flag department-wide capabilities merely because one client register differs.')

def register_rows(package):
    return {m['id']:m for m in package.get('matters',[]) if any(r.get('quote') for r in (m.get('confidentialityEvidence') or {}).get('client_register',[]))}

def register_defects(package, checks):
    expected=register_rows(package)
    if not package.get('rendered_artifact') or not expected:return []
    if len(checks)!=len(expected) or {c.get('matter_id') for c in checks}!=set(expected):
        raise ValueError('review diagnostic not grounded: incomplete source register comparison')
    norm=lambda text:' '.join(str(text or '').split()).casefold()
    defects=[]
    for check in checks:
        if not check.get('rationale'):raise ValueError('review diagnostic not grounded: missing register rationale')
        if check['relationship']!='conflicting':
            if check.get('claims'):raise ValueError('review diagnostic not grounded: claim without source conflict')
            continue
        matter=expected[check['matter_id']]
        rows=[r.get('quote','') for r in matter['confidentialityEvidence']['client_register']]
        register=norm(check.get('register_quote'));narrative=norm(check.get('narrative_quote'))
        if not register or not any(register in norm(r) for r in rows) or not narrative or not any(narrative in norm(matter.get(k)) for k in ('source_excerpt','rawNotes','summary')):
            raise ValueError('review diagnostic not grounded: source register quotes are not literal')
        for claim in check.get('claims',[]):
            quote=norm(claim.get('artifact_quote'));term=norm(claim.get('conflicting_artifact_term'))
            rendered=norm(package.get('rendered_artifact' if claim['scope']=='submission' else 'rendered_audit'))
            if not quote or quote not in rendered or not term or not re.search(r'(?<!\w)'+re.escape(term)+r'(?!\w)',quote):
                raise ValueError('review diagnostic not grounded: sector claim is absent from artifact')
            defects.append({'code':'SOURCE_CONFLICT','severity':'critical','scope':claim['scope'],'matter_id':matter['id'],
                'field_path':'client_sector','conflict_basis':'source_vs_source',
                'conflict_resolution':'omit_nonessential_descriptor' if check.get('nonessential_sector') else 'confirm_source',
                'source_quote':check['register_quote']+'\n'+check['narrative_quote'],**claim,
                'message':('Retira el descriptor sectorial discutido de la redacción, conservando los hechos jurídicos y las fuentes originales. ' if check.get('nonessential_sector') else 'Confirma la discrepancia sectorial que afecta sustancialmente al asunto. ')+check['rationale']})
    return defects
