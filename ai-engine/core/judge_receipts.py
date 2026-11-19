"""Signed reuse of the final judge's own verdicts on unchanged output (v1.0.108).

After a bounded repair the whole rendered pair went back to the final judge,
which re-checked every obligation again (DeForest 19-11: a second 175-200K
token call on the most expensive model). An obligation the judge already
found MET keeps that verdict while its exact output text and its exact
obligation (instruction and sources) are unchanged. The receipt is signed
with the service secret and bound to a digest of both, exactly like field
receipts: a changed word, a changed instruction or a forged receipt is
re-reviewed. Failed obligations and the global acceptance of both files are
always reviewed again.
"""
import hashlib
import hmac
import json
import os
import unicodedata

VERSION = 'judge-receipt-v1'


def _norm(value):
    return ' '.join(unicodedata.normalize('NFC', str(value or '')).split())


def _full_obligations(package, strategy, proposal):
    from core.editorial_case import obligations
    plain = {k: v for k, v in package.items() if k not in ('_verified_field_obligations', 'judge_receipts')}
    return {o['id']: o for o in obligations(plain, strategy, proposal)}


def digest(package, proposal, letter, obligation):
    from core.editorial_case import execution_output
    output, rendered = execution_output(package, proposal, letter, obligation['field'])
    sources = [s.get('id') or s.get('name') or s.get('fullName') or _norm(s.get('source_excerpt'))[:200] for s in obligation.get('sources', [])]
    material = json.dumps({'output': _norm(output), 'rendered': _norm(rendered) if rendered is not None else None,
                           'instruction': _norm(obligation.get('instruction')), 'sources': sources,
                           'field': obligation['field']}, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(material.encode()).hexdigest()


def _signature(receipt, secret):
    unsigned = {k: v for k, v in receipt.items() if k != 'signature'}
    return hmac.new(secret.encode(), json.dumps(unsigned, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode(), hashlib.sha256).hexdigest()


def reusable(package, strategy, proposal, letter, receipts):
    """Obligation IDs whose signed MET verdict still binds to the current text."""
    secret = os.environ.get('AI_ENGINE_SERVICE_TOKEN')
    if not secret or not receipts or proposal.get('version') not in ('editorial-development-v3', 'editorial-development-v4'):
        return []
    current = _full_obligations(package, strategy, proposal)
    valid = []
    for receipt in receipts:
        if not isinstance(receipt, dict) or receipt.get('version') != VERSION or receipt.get('status') != 'met':
            continue
        obligation = current.get(receipt.get('obligation_id'))
        if not obligation or not isinstance(receipt.get('signature'), str):
            continue
        if not hmac.compare_digest(_signature(receipt, secret), receipt['signature']):
            continue
        try:
            if receipt.get('digest') == digest(package, proposal, letter, obligation):
                valid.append(obligation['id'])
        except (KeyError, IndexError, TypeError, ValueError):
            continue
    return list(dict.fromkeys(valid))


def issue(package, strategy, proposal, letter, checks, reused=(), previous=()):
    """Signed receipts for this round's MET checks plus the still-valid reused ones."""
    secret = os.environ.get('AI_ENGINE_SERVICE_TOKEN')
    if not secret:
        return []
    current = _full_obligations(package, strategy, proposal)
    receipts = [r for r in previous or [] if isinstance(r, dict) and r.get('obligation_id') in set(reused)]
    for check in checks or []:
        obligation = current.get(check.get('obligation_id'))
        if not obligation or check.get('status') != 'met':
            continue
        receipt = {'version': VERSION, 'obligation_id': obligation['id'], 'status': 'met',
                   'digest': digest(package, proposal, letter, obligation)}
        receipt['signature'] = _signature(receipt, secret)
        receipts.append(receipt)
    unique = {}
    for receipt in receipts:
        unique[receipt['obligation_id']] = receipt
    return list(unique.values())
