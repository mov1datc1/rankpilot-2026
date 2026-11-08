"""Accept independent repair deltas atomically, rejecting candidate regressions."""
import copy
import json
import re


def accept_repair_deltas(proposal, targets, repair, apply_one, package=None, strategy=None):
    fixed = copy.deepcopy(proposal); failures = {}; seen = set()
    for correction in repair.get('corrections', []):
        path = correction.get('path')
        if path not in targets or path in seen:
            raise ValueError('Repair attempted an invalid or repeated generated field')
        seen.add(path)
        try:
            proposed = apply_one(fixed, {path: targets[path]},
                                 {'corrections': [correction], 'unresolved': []}, allow_unchanged=True)
            match = re.match(r'^candidates/(\d+)(?:/|$)', path)
            if package is not None and match:
                from core.editorial_development import bind_development
                from core.biography_obligations import new_biography_faults
                proposed = bind_development(package, proposed)
                faults = new_biography_faults(package, strategy or {}, fixed, proposed, int(match[1]))
                if faults:
                    raise ValueError('Candidate correction rejected; prior candidate retained. New located defects: '
                                     + json.dumps(faults, ensure_ascii=False, sort_keys=True))
            fixed = proposed
        except ValueError as error:
            failures[path] = str(error)
    if set(targets) - seen and not repair.get('unresolved'):
        raise ValueError('Repair left targets unchanged')
    return fixed, failures
