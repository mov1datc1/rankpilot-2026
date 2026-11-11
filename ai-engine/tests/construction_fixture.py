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
        return project(schema,next(c for c in proposal['candidates'] if c['name']==name))
    value=copy.deepcopy(proposal)
    if schema.__name__=='MatterNarratives':
        ids=set(payload['field_contracts'])
        value['matters']=[m for m in value['matters'] if m['matter_id'] in ids]
    return project(schema,value)
