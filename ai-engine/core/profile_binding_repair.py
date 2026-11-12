"""Reconcile defective derived profile bindings without changing original units."""
from pydantic import create_model, Field
from core.candidate_evidence import ProfileCoverage, profile_privacy_error


def enrich_profile_bindings(package, targets, keyed_items):
    if package is None:
        return targets
    from core.role_evidence import identity
    for path, target in targets.items():
        if 'profile_coverage' not in target.get('mutable_fields', []):
            continue
        candidate = target.get('current_value', {})
        person = next((p for p in package.get('lawyers', [])
                       if identity(p.get('name') or p.get('fullName')) == identity(candidate.get('name'))), {})
        defects = {key: error for key, item in keyed_items(candidate.get('profile_coverage', []))
                   if (error := profile_privacy_error(person, item, package))}
        if not defects:
            continue
        target['profile_binding_repairs'] = defects
        # Names, routes and original restrictions suffice; do not resend narratives.
        target['profile_binding_evidence'] = {'person': person, 'matters': [
            {k: m[k] for k in ('id', 'client', 'name', 'title', 'publication_route', 'resolved_publication_status') if k in m}
            for m in package.get('matters', [])]}
        target['problem'] += (' The listed profile_binding_repairs are invalid derived bindings, not immutable source facts. '
                              'Correct only those keyed bindings against profile_binding_evidence. Original references and '
                              'complete source quotations remain fixed. For a non-material client example in a multi-entity '
                              'unit whose substantive work is already preserved and whose exact name has no literal restriction '
                              'match, use decision=omit with public_quote=\'\' and privacy_basis=null. Unproven aliases remain '
                              'observations in source_notes while still returning status=corrected for the biography; never invent permission.')
    return targets


def binding_output_model(target, key, output_model):
    if key not in target.get('profile_binding_repairs', {}):
        return output_model
    return create_model('ProfileBindingOutput_' + key, __base__=output_model, **{
        name: (ProfileCoverage.model_fields[name].annotation,
               Field(description='Correct this derived binding from the supplied original evidence; never modify its source.'))
        for name in ('entity_name', 'relationship', 'privacy_basis')})


def validate_binding_delta(target, key, item):
    if key not in target.get('profile_binding_repairs', {}):
        return
    evidence = target['profile_binding_evidence']
    error = profile_privacy_error(evidence['person'], item, evidence)
    if error:
        raise ValueError('Profile binding ' + key + ': ' + error)
    # Entity/source membership and real restrictions are checked above. The
    # ordinary profile/materiality and independent semantic checks still apply.
