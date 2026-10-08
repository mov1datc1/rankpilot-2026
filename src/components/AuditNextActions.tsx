'use client';
import {useState} from 'react';
import {auditActions,auditActionHasResponse,type AuditAction} from '@/lib/audit/next-actions';
const buttonStyle={border:'1px solid #C7D2FE',borderRadius:7,padding:'8px 12px',background:'#EEF2FF',color:'#3730A3',fontWeight:600,cursor:'pointer'};
export function AuditNextActions({data,busy,onNavigate,onReferences,onPrepare,submissionId}:{data:any;busy:boolean;onNavigate:(action:AuditAction)=>void;onReferences:(action:AuditAction,notes:string)=>Promise<void>;onPrepare:()=>void;submissionId:string}) {
  const [editing,setEditing]=useState<AuditAction|null>(null),[notes,setNotes]=useState(''),[saving,setSaving]=useState(false),[error,setError]=useState('');
  const actions=auditActions(data.editorial_review?.letter),answered=actions.filter(a=>auditActionHasResponse(data,a)).length;
  return <section id="audit-next-actions" aria-label="Acciones del Audit" style={{scrollMarginTop:110}}>
    <p>Completa aquí la información que tengas. No necesitas rehacer ni volver a subir el documento. Estas recomendaciones no bloquean por sí solas la descarga; los conflictos que impidan entregar aparecen en el panel de revisión.</p>
    <p role="status">{actions.length-answered} recomendaciones sin respuesta · {answered} con información guardada{data.final_review_stale?' · pendiente de revisar en los documentos':''}.</p>
    {actions.map(action=><section key={action.id} style={{border:'1px solid #CBD5E1',borderRadius:10,padding:16,marginBottom:12}}>
      <p style={{marginTop:0,whiteSpace:'pre-wrap'}}>{action.message}</p>
      {auditActionHasResponse(data,action)&&<p style={{color:'#166534'}}>Información guardada. RankPilot comprobará si resuelve la recomendación al actualizar los documentos.</p>}
      <button style={buttonStyle} type="button" disabled={busy||saving} onClick={()=>{setError('');if(action.kind==='references'){setNotes(data.audit_referee_notes || '');setEditing(action);}else onNavigate(action);}}>{action.cta} →</button>
      {editing?.id===action.id&&<form onSubmit={async e=>{e.preventDefault();setSaving(true);setError('');try{await onReferences(action,notes);setEditing(null);}catch(err){setError(err instanceof Error?err.message:'No se pudo guardar.');}finally{setSaving(false);}}}>
        <label style={{display:'block',marginTop:12}}>Referencias disponibles y fuente<textarea autoFocus aria-label="Referencias disponibles y fuente" maxLength={8000} rows={6} disabled={saving} value={notes} onChange={e=>setNotes(e.target.value)} style={{width:'100%',display:'block',border:'1px solid #94A3B8',borderRadius:6,padding:8}} /></label>
        <p>Indica cliente, persona de contacto, abogado o asunto relacionado y procedencia del dato. Se guarda como información interna: no implica un testimonio, no se publica en el Submission y no contactaremos a nadie. Si aún no tienes referencias, puedes continuar con los documentos actuales.</p>
        {error&&<p role="alert">{error}</p>}
        <button style={buttonStyle} type="submit" disabled={saving||!notes.trim()}>{saving?'Guardando…':'Guardar y volver al Audit'}</button>{' '}<button style={buttonStyle} type="button" disabled={saving} onClick={()=>setEditing(null)}>Cancelar</button>
      </form>}
    </section>)}
    <p>Cuando añadas información, pulsa «Actualizar documentos» para incorporarla y comprobar qué recomendaciones siguen vigentes. Se reutilizarán las etapas cuyo contenido no haya cambiado. Más información puede fortalecer la candidatura, pero no garantiza un ranking.</p>
    <button style={buttonStyle} type="button" disabled={busy||saving} onClick={onPrepare}>{busy?'Preparando…':'Actualizar documentos'}</button>
    {data.previous_approved_artifact&&<p>Mientras se revisan tus cambios, puedes descargar la última versión revisada, que todavía no los incluye: <a href={`/api/generate-docx?id=${encodeURIComponent(submissionId)}&type=submission&mode=previous`}>Submission anterior</a>{' · '}<a href={`/api/generate-docx?id=${encodeURIComponent(submissionId)}&type=audit&mode=previous`}>Audit anterior</a>.</p>}
  </section>;
}
