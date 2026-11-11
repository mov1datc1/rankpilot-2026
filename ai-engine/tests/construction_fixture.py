import copy
from pydantic import BaseModel

def project(schema, value):
    result={}
    for k,field in schema.model_fields.items():
        if k not in value:continue
        v=copy.deepcopy(value[k]);annotation=field.annotation
        if isinstance(annotation,type) and issubclass(annotation,BaseModel):v=project(annotation,v)
        elif getattr(annotation,'__origin__',None) is list:
            item=annotation.__args__[0]
            if isinstance(item,type) and issubclass(item,BaseModel):v=[project(item,x) for x in v]
        result[k]=v
    return result

def answer(schema, payload, proposal):
    if schema.__name__=='OwnedBiography':
        name=payload['shared_decision']['name']
        candidate=copy.deepcopy(next(c for c in proposal['candidates'] if c['name']==name))
        bindings=payload.get('source_bindings')
        if bindings:
            candidate['profile_coverage']={u['reference']:[{k:v for k,v in e.items() if k not in ('reference','source_quote')}
                for e in candidate['profile_coverage'] if e['reference']==u['reference']] for u in bindings['profile_units']}
            links={e['matter_id']:e['public_quote'] for e in candidate['submission_case_coverage']}
            candidate['submission_case_coverage']={key:links.get(source['matter_id']) for key,source in bindings['case_sources'].items()}
        return project(schema,candidate)
    value=copy.deepcopy(proposal)
    if schema.__name__=='MatterNarratives':
        ids=set(payload['field_contracts'])
        value['matters']=[m for m in value['matters'] if m['matter_id'] in ids]
        if payload.get('source_bindings'):
            register={m['matter_id']:m for m in value['matters']}
            value['matters']={key:{'text':register[source['matter_id']]['text'],
                'completion_status':register[source['matter_id']].get('completion_status',''),
                'anchor_execution':{ref:register[source['matter_id']]['text'] for ref in source['anchors']}}
                for key,source in payload['source_bindings'].items()}
    if schema.__name__=='InstitutionalProse' and payload.get('argument_bindings'):
        value['institutional_execution']={f'A{e["argument_index"]+1:02d}':{k:v for k,v in e.items() if k!='argument_index'} for e in value['institutional_execution']}
    return project(schema,value)
