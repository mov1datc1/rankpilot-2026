'use client';

import { reviewIssues, reviewIsStale, type ReviewDestination } from '@/lib/audit/review-actions';

export function ReviewPanel({data,errors,warnings,approved,onResolve,busy=false,job}:{data:any;errors:string[];warnings:string[];approved:boolean;busy?:boolean;job?:any;onResolve:(destination:ReviewDestination,message:string)=>void}) {
  const stopped=job?.issue && !['queued','running','completed'].includes(job.status);
  const issues=approved ? [] : reviewIssues(data,errors);
  if(stopped && job.issue.owner==='rankpilot') {
    const remaining=issues.filter(issue=>!['retry-review','review','retry-selection'].includes(issue.destination));
    issues.splice(0,issues.length,{title:'Reanudar la preparación',owner:'RankPilot',action:job.issue.message,destination:'retry-review',message:'La entrega aún no está lista. RankPilot conserva las fuentes y comprueba qué etapas puede reutilizar antes de continuar.'},...remaining);
  }
  const humanCount=issues.filter(issue=>issue.owner!=='RankPilot').length;
  const systemCount=issues.length-humanCount;
  const stale=reviewIsStale(data);
  return <section aria-label="Estado de entrega" style={{background:'#fff',border:'1px solid #CBD5E1',borderRadius:14,padding:'1.25rem',color:'#0F172A',overflowWrap:'anywhere'}}>
    <div style={{fontSize:12,fontWeight:700,color:approved?'#15803D':'#B45309',textTransform:'uppercase',letterSpacing:1}}>Entrega {approved?'aprobada':'pendiente'}</div>
    <h2 style={{fontSize:22,margin:'8px 0'}}>{approved?'Documentos revisados y disponibles':humanCount ? `${humanCount} ${humanCount===1?'pendiente por responder':'pendientes por responder'}` : stopped?'RankPilot no pudo completar la preparación':'Listo para preparar Submission y Audit'}</h2>
    {!approved && systemCount>0 && <p style={{fontSize:13,color:'#4338CA'}}>{systemCount} {systemCount===1?'tarea de RankPilot':'tareas de RankPilot'} · La entrega se habilita después de comprobar el documento.</p>}
    <p style={{fontSize:14,lineHeight:1.6,color:'#475569',margin:'0 0 16px'}}>Las redacciones guardadas se conservan. {approved ? 'Submission y Audit disponibles para descargar.' : data?.editorial_review?.letter?'El Audit está disponible como revisión interna; aún no equivale a una entrega aprobada.':'El Audit se redacta durante la revisión editorial.'}</p>
    {data?.final_artifact_review && !approved && <p style={{fontSize:12,color:'#64748B'}}>{stale ? 'Guardado confirmado. La revisión anterior corresponde a una versión previa del expediente.' : 'Hallazgos de la última revisión. Se actualizan al revisar las correcciones guardadas.'}</p>}
    <div style={{display:'grid',gap:10}}>{issues.map((issue,index)=><div key={`${index}-${issue.title}`} style={{border:'1px solid #E2E8F0',borderRadius:10,padding:14}}>
      <span style={{fontSize:11,fontWeight:700,color:issue.owner==='RankPilot'?'#4338CA':'#92400E'}}>{issue.owner}</span>
      <h3 style={{fontSize:15,margin:'5px 0'}}>{issue.title}</h3>
      <p style={{fontSize:13,lineHeight:1.6,margin:'6px 0 10px',color:'#475569'}}>{issue.action}</p>
      <button type="button" disabled={busy} onClick={()=>onResolve(issue.destination==='review'?'retry-review':issue.destination,issue.message)} style={{color:'#4338CA',background:'#EEF2FF',border:'1px solid #C7D2FE',borderRadius:7,padding:'7px 10px',fontWeight:600,cursor:'pointer'}}>{issue.destination==='retry-selection'?(busy?'Reintentando…':'Reintentar selección'):issue.destination==='retry-review'||issue.destination==='review'?(stopped?'Reanudar preparación':stale?'Revisar correcciones guardadas':'Preparar Submission y Audit'):issue.destination==='period'?'Completar periodo':issue.destination==='ranking'?'Verificar ranking':'Corregir este pendiente'} →</button>
      <details style={{fontSize:13,lineHeight:1.65,marginTop:10}}><summary style={{cursor:'pointer',color:'#475569'}}>Ver hallazgo y personas o asuntos afectados</summary><p style={{whiteSpace:'pre-wrap',marginBottom:0}}>{issue.message}</p></details>
    </div>)}</div>
    {stale && <details style={{marginTop:16,fontSize:13,lineHeight:1.6}}><summary style={{cursor:'pointer'}}>Ver hallazgos de la versión anterior</summary><p>Se conservan como historial; falta comprobar cuáles siguen vigentes.</p><ul>{(data.final_artifact_review.judge?.defects || []).map((d:any,i:number)=><li key={i}>{d.message}</li>)}</ul></details>}
    {!stale && warnings.length>0 && <details style={{marginTop:16,fontSize:13,lineHeight:1.6}}><summary style={{cursor:'pointer'}}>Otras observaciones ({warnings.length})</summary><ul>{warnings.map((w,i)=><li key={i}>{w}</li>)}</ul></details>}
    {!approved && <p style={{fontSize:13,lineHeight:1.6,color:'#475569',marginBottom:0}}>{stopped && job.issue.owner==='rankpilot' ? 'No tienes que corregir las citas generadas ni volver a subir el documento. Reanuda la preparación desde este panel.' : issues.some(issue=>issue.destination==='retry-selection') ? 'Pulsa «Reintentar selección». RankPilot repetirá esa etapa y continuará con el Audit y la revisión del Word si la selección supera la comprobación.' : 'Después de guardar las correcciones, pulsa «Preparar Submission y Audit». Se reutiliza el avance que siga vigente; la descarga se habilita cuando el Word supera la revisión.'}</p>}
  </section>;
}

export function ReadableAudit({letter,label}:{letter:any;label:string}) {
  const sections=[['executive_assessment','Evaluación ejecutiva','Lectura inicial'],['next_steps','Próximos pasos','Qué falta para avanzar'],['evidence_gaps','Evidencia pendiente','Datos que necesitan respaldo'],['portfolio','Portafolio seleccionado','Asunto insignia, selección y reservas'],['leadership','Liderazgo y atribución','Evaluación de cada abogado']];
  return <article style={{background:'#fff',padding:'clamp(16px, 3vw, 32px)',borderRadius:14,border:'1px solid #E2E8F0',color:'#0F172A',overflowWrap:'anywhere'}}>
    <p style={{fontSize:12,fontWeight:700,color:'#4338CA',margin:0}}>STRATEGIC AUDIT · {label}</p>
    <h2 style={{fontSize:26,margin:'8px 0'}}>Tu estrategia, por partes</h2>
    <p style={{fontSize:14,lineHeight:1.6,color:'#64748B',marginBottom:24}}>Empieza por la evaluación y los próximos pasos. Abre cada sección para consultar la evidencia completa.</p>
    {sections.map(([key,title,subtitle],index)=><details key={key} open={index===0 || index===1} style={{borderTop:'1px solid #E2E8F0',padding:'18px 0'}}>
      <summary style={{cursor:'pointer',fontSize:17,fontWeight:700}}>{title}<span style={{display:'block',margin:'5px 0 0 18px',fontSize:12,fontWeight:400,color:'#64748B'}}>{subtitle}</span></summary>
      <div style={{fontSize:15,lineHeight:1.8,maxWidth:'72ch',marginTop:16}}>{String(letter[key] || 'Sin contenido en esta revisión.').split(/\n\s*\n|\n(?=\d+[.)]\s)|(?<=\.)\s+(?=\d+[.)]\s)/).filter(Boolean).map((block,i)=><p key={i} style={{whiteSpace:'pre-wrap',margin:'0 0 16px',paddingLeft:/^\d+[.)]/.test(block)?12:0,borderLeft:/^\d+[.)]/.test(block)?'3px solid #C7D2FE':undefined}}>{block}</p>)}</div>
    </details>)}
  </article>;
}
