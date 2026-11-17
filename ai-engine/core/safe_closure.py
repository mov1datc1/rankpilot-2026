"""Last-resort closure when the initial repair is exhausted: never stop, never leak.

Only sentences that the deterministic checks reject are withdrawn from generated
prose: sentences carrying the identifying metrics of a confidential mandate in
public fields, and sentences in auditor voice. Nothing is rewritten or invented.
The result must pass the privacy check again; otherwise the case still stops,
because a confidentiality leak is never delivered. Every withdrawal is recorded.
"""
import copy
import re

SPLIT = re.compile(r'(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ"“(])')


def _sentences(text):
    out = []
    for paragraph in re.split(r'(\n+)', str(text or '')):
        if paragraph.startswith('\n'):
            out.append(paragraph)
        else:
            out.extend([s for s in SPLIT.split(paragraph) if s])
    return out


def _join(parts):
    text = ''
    for part in parts:
        if part.startswith('\n') or not text or text.endswith('\n'):
            text += part
        else:
            text += ' ' + part
    return re.sub(r'\n{3,}', '\n\n', text).strip()


def _get(proposal, path):
    node = proposal
    for part in path.split('/'):
        node = node[int(part)] if isinstance(node, list) else node[part]
    return node


def _set(proposal, path, value):
    parts = path.split('/')
    node = proposal
    for part in parts[:-1]:
        node = node[int(part)] if isinstance(node, list) else node[part]
    node[int(parts[-1]) if isinstance(node, list) else parts[-1]] = value


def _voice(sentence):
    from core.editorial_development import submission_voice_paths
    return bool(submission_voice_paths({'b10': sentence}))


def close_public_faults(package, strategy, proposal):
    """Return (proposal, withdrawn) with privacy and voice faults removed, or (None, withdrawn)."""
    from core.public_privacy import public_privacy_findings, metric_facts
    from core.editorial_development import submission_voice_paths
    result = copy.deepcopy(proposal)
    withdrawn = []
    for _ in range(3):
        findings = public_privacy_findings(package, strategy, result)
        if not findings:
            break
        for finding in findings:
            path = finding['path']
            shared = {tuple(m) if isinstance(m, list) else m for m in finding.get('metrics', [])}
            text = _get(result, path)
            kept = []
            for sentence in _sentences(text):
                if not sentence.startswith('\n') and shared and (metric_facts(sentence) & shared):
                    withdrawn.append({'path': path, 'reason': 'confidential_metrics', 'matter_id': finding.get('matter_id'), 'sentence': sentence})
                else:
                    kept.append(sentence)
            _set(result, path, _join(kept))
    if public_privacy_findings(package, strategy, result):
        return None, withdrawn
    for path in submission_voice_paths(result):
        text = _get(result, path)
        kept = []
        for sentence in _sentences(text):
            if not sentence.startswith('\n') and _voice(sentence):
                withdrawn.append({'path': path, 'reason': 'auditor_voice', 'sentence': sentence})
            else:
                kept.append(sentence)
        if any(not s.startswith('\n') for s in kept):
            _set(result, path, _join(kept))
    # Output bindings that cited a withdrawn sentence are no longer literal.
    for candidate in result.get('candidates', []):
        bio = ' '.join(str(candidate.get('submission_bio') or '').split())
        candidate['submission_case_coverage'] = [item for item in candidate.get('submission_case_coverage') or []
                                                 if ' '.join(str(item.get('public_quote') or '').split()) in bio]
    return result, withdrawn


def close_exhausted_development(state, result):
    """Continue to field review with observations instead of stopping, when safe."""
    from core.development_delivery import complete_proposal_findings
    from core.editorial_repair import unknown_repair_usage
    merged = {**state, **result}
    proposal = result.get('development')
    if (not result.get('errors') or not result.get('development_repair_unlocatable') or not proposal
            or result.get('repair_continuation') or unknown_repair_usage(merged.get('trace', []))
            or proposal.get('construction_contract') != 'editorial-construction-v1'):
        return None
    closed, withdrawn = close_public_faults(state['package'], state['strategy'], proposal)
    if closed is None:
        return None
    findings = complete_proposal_findings({**merged, 'development': closed})
    if findings is None:
        return None
    from core.field_review import schedule
    retained = {**result, 'development': closed, 'development_validated': False, 'development_delivery_ready': False,
                'development_repair_unlocatable': False, 'development_observations': list(dict.fromkeys(findings)),
                'repair_continuation': None, 'errors': [],
                'safe_closure': {'version': 'safe-closure-v1', 'withdrawn': withdrawn, 'observations': findings}}
    return schedule(merged, retained)
