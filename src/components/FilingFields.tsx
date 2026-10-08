'use client';

export function FilingFields({value,onChange,evidence={},statuses={},disabled=false}:{value:any;onChange:(value:any)=>void;evidence?:any;statuses?:any;disabled?:boolean}) {
  const change=(key:string,next:any)=>onChange({...value,[key]:next});
  const source=(key:string)=><>{statuses[key]==='conflicting' && <p role="status" style={{color:'#92400E',fontSize:13}}>Las fuentes discrepan. Confirma el dato correcto; las alternativas se conservan abajo.</p>}{evidence[key]?.length>0 && <details style={{fontSize:12,color:'#475569'}}><summary>Ver dato en la fuente</summary>{evidence[key].map((item:any,i:number)=><blockquote key={i} style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',margin:8}}>{item.source && <strong>{item.source}: </strong>}{item.quote}</blockquote>)}</details>}</>;
  return <div style={{display:'grid',gap:12}}>
    {[['departmentName','Nombre del departamento'],['numPartners','Número de socios del departamento'],['numLawyers','Número de otros abogados del departamento']].map(([key,label])=><label key={key}>{label}
      <input aria-label={label} disabled={disabled} type={key.startsWith('num')?'number':'text'} min={0} step={1} value={value[key] ?? ''} onChange={e=>change(key,e.target.value)} style={{display:'block',width:'100%',border:'1px solid #CBD5E1',borderRadius:6,padding:8}} />
      {source(key)}
    </label>)}
    {(['contacts','departmentHeads'] as const).map(key=><fieldset key={key} style={{border:'1px solid #CBD5E1',borderRadius:6}}><legend>{key==='contacts'?'Contacto para entrevistas':'Responsables del departamento'}</legend>{source(key)}{(value[key]?.length?value[key]:[{name:'',email:'',phone:''}]).map((person:any,i:number)=><div key={i} style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:8}}>{[['name','Nombre'],['email','Correo'],['phone','Teléfono']].map(([field,label])=><label key={field} style={{flex:'1 1 130px',minWidth:0}}>{label}<input aria-label={`${key} ${i+1} ${label}`} disabled={disabled} value={person[field] || ''} style={{width:'100%'}} onChange={e=>change(key,(value[key]?.length?value[key]:[person]).map((p:any,j:number)=>j===i?{...p,[field]:e.target.value}:p))} /></label>)}</div>)}<button type="button" disabled={disabled || value[key]?.length>=50} onClick={()=>change(key,[...(value[key] || []),{name:'',email:'',phone:''}])}>Añadir persona</button></fieldset>)}
  </div>;
}
