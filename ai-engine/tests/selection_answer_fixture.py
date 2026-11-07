"""Transport fixtures for old decision-level scenarios using field repair."""
def repair_answer(payload, decisions):
    if not all(c.get('field_paths') for c in payload.get('failed_checks',{}).values()):
        return {'core_corrections':[d for d in decisions if d['disposition']=='core'],
                'other_corrections':[d for d in decisions if d['disposition']!='core'],'unresolved':[]}
    return {'corrections':[{'matter_id':d['matter_id'],'field_path':field,'text':d[field]}
        for d in decisions for field in payload['failed_checks'][d['matter_id']]['field_paths']]}
