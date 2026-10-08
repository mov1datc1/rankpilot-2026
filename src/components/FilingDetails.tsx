'use client';
import { useState, useEffect } from 'react';
import { filingDetailsGaps } from '@/lib/audit/filing-details';
const emptyPerson=()=>({name:'',email:'',phone:''});
export function FilingDetails({data,onSave,openRequest=0,onCancel,saveLabel='Guardar y volver al panel'}:{data:any;openRequest?:number;saveLabel?:string;onCancel?:()=>void;onSave:(value:any)=>Promise<boolean>}) {
  const [editing,setEditing]=useState(false),[busy,setBusy]=useState(false);
  const [draft,setDraft]=useState<any>({});
  const gaps=filingDetailsGaps(data);
  const open=()=>{setDraft({departmentName:data.departmentName || '',numPartners:data.numPartners ?? '',numLawyers:data.numLawyers ?? '',contacts:data.contacts?.length?data.contacts:[emptyPerson()],departmentHeads:(data.departmentHeads || data.department?.department_heads)?.length?(data.departmentHeads || data.department.department_heads):[emptyPerson()],target_band:data.target_band || data.targetBand || ''});setEditing(true);};
  useEffect(()=>{if(openRequest)open();},[openRequest]);
  const change=(key:string,value:any)=>setDraft((d:any)=>({...d,[key]:value}));
  return <section id="studio-filing-details" aria-label="Datos antes de presentar" style={{border:'1px solid #CBD5E1',borderRadius:12,padding:18,marginTop:12,background:'#fff'}}>
    <strong>Datos antes de presentar</strong>
    <p>{gaps.length?`${gaps.length} campos por completar o revisar: ${gaps.join('; ')}.`:'Datos administrativos registrados.'} La revisión de los documentos no sustituye comprobar estos datos y la ventana de investigación.</p>
    {!editing?<button type="button" onClick={open}>Revisar datos y objetivo →</button>:<form onSubmit={async e=>{e.preventDefault();setBusy(true);try{if(await onSave(draft))setEditing(false);}finally{setBusy(false);}}}>
      <div style={{display:'grid',gap:12}}>
        {[['departmentName','Nombre del departamento'],['numPartners','Número de socios'],['numLawyers','Número de otros abogados'],['target_band','Objetivo de ranking (si está definido)']].map(([key,label])=><label key={key}>{label}<input aria-label={label} disabled={busy} type={key.startsWith('num')?'number':'text'} min={0} step={1} value={draft[key]} onChange={e=>change(key,e.target.value)} style={{display:'block',width:'100%',border:'1px solid #CBD5E1',padding:8}} /></label>)}
        {(['contacts','departmentHeads'] as const).map(key=><fieldset key={key}><legend>{key==='contacts'?'Contacto para entrevistas':'Responsables del departamento'}</legend>{draft[key].map((person:any,i:number)=><div key={i} style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:8}}>{[['name','Nombre'],['email','Correo'],['phone','Teléfono']].map(([field,label])=><label key={field}>{label}<input aria-label={`${key} ${i+1} ${label}`} disabled={busy} value={person[field]} onChange={e=>change(key,draft[key].map((p:any,j:number)=>j===i?{...p,[field]:e.target.value}:p))} /></label>)}</div>)}<button type="button" disabled={busy || draft[key].length>=50} onClick={()=>change(key,[...draft[key],emptyPerson()])}>Añadir persona</button></fieldset>)}
      </div>
      <p>Conserva los campos vacíos si aún no conoces el dato. El objetivo es una solicitud, no una posición actual ni una garantía.</p>
      <button disabled={busy} type="submit">{busy?'Guardando…':saveLabel}</button>{' '}<button disabled={busy} type="button" onClick={()=>{setEditing(false);onCancel?.();}}>Cancelar</button>
    </form>}
  </section>;
}
