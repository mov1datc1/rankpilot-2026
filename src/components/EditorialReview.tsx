'use client';

import {observationPresentation} from '@/lib/audit/observation-presentation';
import {getDeliveryState} from '@/lib/audit/delivery-state';
import { reviewIssues, reviewIsStale, isStoppedSelection, type ReviewDestination } from '@/lib/audit/review-actions';
import { Sparkles } from 'lucide-react';

export function ReviewPanel({data,errors,warnings,approved,onResolve,busy=false,job,onRefresh,connectionError=false}:{data:any;errors:string[];warnings:string[];approved:boolean;busy?:boolean;job?:any;onRefresh?:()=>void;connectionError?:boolean;onResolve:(destination:ReviewDestination,message:string)=>void}) {
  const delivery=getDeliveryState(data,data?.matters || [],true);
  const available=delivery.available;
  const stopped=!available && job?.sourceMatches!==false && (job?.issue || job?.pauseReason) && !['queued','running','completed'].includes(job.status);
  const isRunning=!!job && ['queued','running'].includes(job.status);
  const canResumeResidual=job?.canResumeResidual===true && job?.sourceMatches!==false;
  const systemManaged=isRunning || Boolean(stopped && !canResumeResidual && (job?.pauseReason || ['rankpilot','Optimización editorial'].includes(job?.issue?.owner)));
  const recovering=job?.recovering || ((job?.issue?.owner==='rankpilot' || job?.issue?.owner==='Optimización editorial') && isRunning);
  const issues=approved ? [] : reviewIssues(data,errors,available ? null:job);
  const humanCount=issues.filter(issue=>issue.owner!=='RankPilot' && issue.owner!=='Optimización editorial').length;
  const systemCount=issues.length-humanCount;
  const totalIssues=issues.length;
  const stale=reviewIsStale(data);
  const recoveryInstructions=job?.nextAction?.description || 'Consulta el estado actualizado de este expediente. Tus fuentes y el avance están guardados; no necesitas volver a cargar el original.';
  const refreshNotice=(connectionError || job?.nextAction?.kind==='refresh' || (stopped && systemManaged)) && <div role="status" style={{padding:12,background:'#EEF2FF',marginBottom:16,borderRadius:8}}>
    {connectionError && <p>No se pudo actualizar la pantalla. Mostramos el último estado confirmado y volveremos a consultar automáticamente. Esta interrupción no reinicia la preparación ni pone los contadores a cero.</p>}
    {onRefresh && <><button type="button" onClick={onRefresh} style={{padding:'8px 12px',cursor:'pointer'}}>Actualizar estado</button><p style={{fontSize:12}}>Consulta el avance guardado, sin iniciar otra generación.</p></>}
  </div>;
  if(available) {
    const findings=(data?.final_artifact_review?.judge?.defects || []);
    const findingMessages=new Set(findings.map((d:any)=>d.message));
    const messages=[...findings,...errors.filter(message=>!findingMessages.has(message)).map(message=>({message}))];
    const seen=new Set(messages.map((d:any)=>d.message));
    const all=[...messages,...warnings.filter(message=>!seen.has(message)).map(message=>({message}))];
    const fieldLabel=(d:any)=>{
      const path=String(d.field_path || '');
      const candidate=path.match(/^candidates\/(\d+)/) || String(d.message || '').match(/Calidad personal candidates\/(\d+)/);
      const matter=path.match(/^matters\/(\d+)\//);
      const personal=String(d.message || '').match(/^(?:Caso personal B9|Perfil B9):\s*([^:]+):/);
      if(personal)return `B9 · ${personal[1]}`;
      if(matter) {
        const id=data.editorial_development?.matters?.[Number(matter[1])]?.matter_id;
        return `Asunto · ${data.matters?.find((m:any)=>m.id===id)?.client || 'Redacción del asunto'}`;
      }
      return candidate ? `B9 · ${data.editorial_development?.candidates?.[Number(candidate[1])]?.name || 'Candidatura'}`
        : path==='b10'?'B10 · Departamento':path==='c2'?'C2 · Posicionamiento':path==='research_period'?'Periodo de investigación'
        : path==='client'?'Identificación del cliente':d.scope==='letter' || ['executive_assessment','rendered_audit'].includes(path)?'Audit':'Documentos';
    };
    return <section aria-label="Estado de entrega" style={{background:'#fff',border:'1px solid #CBD5E1',borderRadius:14,padding:'1.25rem',color:'#0F172A'}}>
      {refreshNotice}
      <h2 style={{fontSize:22,margin:'0 0 10px'}}>{delivery.label}</h2>
      <p>Descarga el Submission y el Audit desde «Descargar». {delivery.hasObservations?'Consulta estos hallazgos antes de presentarlos; no necesitas iniciar otro intento para obtener los archivos.':'La revisión no dejó observaciones pendientes.'}</p>
      {all.map((d:any,i:number)=>{const observation=observationPresentation(d);return <article key={i} style={{borderTop:'1px solid #E2E8F0',padding:'16px 0'}}>
        <h3 style={{fontSize:16,margin:'0 0 8px'}}>{fieldLabel(d)} · {observation.title}</h3>
        <p style={{margin:'8px 0',lineHeight:1.6}}>{observation.explanation}</p>
        <p style={{margin:'8px 0',lineHeight:1.6}}><strong>Qué puedes hacer: </strong>{observation.action}</p>
        {observation.destination && <button type="button" disabled={busy} onClick={()=>onResolve(observation.destination!,d.message)} style={{cursor:'pointer',padding:'8px 12px',marginBottom:10}}>{observation.button} →</button>}
        <details>
          <summary style={{cursor:'pointer'}}>Ver detalle y citas de la revisión</summary>
          <p><strong>Mensaje original de la revisión:</strong> {d.message}</p>
          {d.artifact_quote && <p><strong>En el documento:</strong> {d.artifact_quote}</p>}
          {d.source_quote && <p><strong>En la fuente:</strong> {d.source_quote}</p>}
        </details>
      </article>;})}
    </section>;
  }
  return <>
    {!available && !approved && !job?.nextAction && (
      <div style={{
        background: 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)',
        border: '1px solid #FDBA74',
        borderRadius: 12,
        padding: '12px 18px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        boxShadow: '0 2px 8px rgba(234, 88, 12, 0.07)'
      }}>
        <div style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: 'linear-gradient(135deg, #EA580C 0%, #C2410C 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          flexShrink: 0,
          boxShadow: '0 2px 6px rgba(234, 88, 12, 0.25)'
        }}>
          <Sparkles size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span style={{
              fontSize: 10.5,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: 0.8,
              color: '#C2410C',
              background: '#FFEDD5',
              padding: '2px 8px',
              borderRadius: 6,
              border: '1px solid #FDBA74'
            }}>
              {data?.draft_artifact ? 'Documentos en preparación' : 'Preparación de documentos'}
            </span>
          </div>
          <p style={{
            fontSize: 13,
            lineHeight: 1.5,
            color: '#7C2D12',
            margin: 0,
            fontWeight: 500
          }}>
            Aquí verás cuándo están disponibles el Submission y el Audit. {humanCount > 0 ? 'Las confirmaciones que requieren tu respuesta aparecen abajo.' : systemManaged ? (isRunning ? (job?.nextAction?.description || 'La revisión está en curso. Espera a que termine; puedes cerrar esta pestaña y volver después.') : recoveryInstructions) : 'Pulsa la acción del pendiente para preparar los documentos.'}
          </p>
        </div>
      </div>
    )}
    <section aria-label="Estado de entrega" style={{background:'#fff',border:'1px solid #CBD5E1',borderRadius:14,padding:'1.25rem',color:'#0F172A',overflowWrap:'anywhere'}}>
    <div style={{fontSize:12,fontWeight:700,color:approved?'#15803D':'#B45309',textTransform:'uppercase',letterSpacing:1}}>{available?'Documentos disponibles':'Preparación de documentos'}</div>
    <h2 style={{fontSize:22,margin:'8px 0'}}>{available?delivery.label:job?.nextAction?.title || (recovering?'Preparando documentos':canResumeResidual?'Listo para continuar la preparación':stopped?'Preparación de documentos':humanCount ? `${humanCount} ${humanCount===1?'pendiente por responder':'pendientes por responder'}` : 'Listo para preparar Submission y Audit')}</h2>
    {!available && job?.nextAction && <p role="status" style={{fontSize:14,lineHeight:1.6,color:'#334155'}}>{job.nextAction.description}</p>}
    {!approved && !job?.nextAction && systemCount>0 && <p style={{fontSize:13,color:'#4338CA'}}>{systemCount} {systemCount===1?'tarea de RankPilot':'tareas de RankPilot'} · {stopped ? 'Consulta abajo la acción necesaria.' : 'El siguiente paso aparece junto a cada observación.'}</p>}
    <p style={{fontSize:14,lineHeight:1.6,color:'#475569',margin:'0 0 16px'}}>Las redacciones guardadas se conservan. {available ? 'Descarga Submission y Audit. Consulta abajo los hallazgos y qué conviene revisar antes de presentarlos.' : 'El Submission y el Audit se preparan con el avance guardado.'}</p>
    {refreshNotice}
    {data?.final_artifact_review && !approved && <p style={{fontSize:12,color:'#64748B'}}>{stale ? 'Guardado confirmado. La revisión anterior corresponde a una versión previa del expediente.' : 'Hallazgos de la última revisión. Se actualizan al revisar las correcciones guardadas.'}</p>}
    {stopped && !systemManaged && !approved && job?.issue?.owner!=='user' && (
      <div style={{background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:10,padding:'14px 18px',marginBottom:16,display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
        <div>
          {!job?.nextAction && <><div style={{fontSize:14,fontWeight:700,color:'#166534'}}>{canResumeResidual?'Continuar la corrección guardada':'Continuar preparación de documentos'}</div>
          <div style={{fontSize:13,color:'#15803D',marginTop:2}}>{canResumeResidual?'Se conserva el avance y se corregirán solo los campos pendientes.':'El sistema aplicará las mejoras editoriales y revisará ambos documentos.'}</div></>}
        </div>
        <button type="button" disabled={busy} onClick={()=>onResolve('retry-review','Reanudar preparación')} style={{background:'#16A34A',color:'#fff',border:'none',borderRadius:8,padding:'9px 18px',fontWeight:700,cursor:'pointer',fontSize:13,boxShadow:'0 1px 2px rgba(0,0,0,0.05)'}}>
          {busy ? 'Preparando…' : canResumeResidual?'Continuar preparación →':'Preparar documentos →'}
        </button>
      </div>
    )}
    <div style={{display:'grid',gap:10}}>{issues.map((issue,index)=>job?.nextAction && ['RankPilot','Optimización editorial'].includes(issue.owner) ? <details key={`${index}-${issue.title}`} style={{borderTop:'1px solid #E2E8F0',padding:'12px 0'}}>
      <summary style={{cursor:'pointer',fontSize:14,fontWeight:600}}>Hallazgo de la revisión: {issue.title}</summary>
      <p style={{fontSize:13,lineHeight:1.6,whiteSpace:'pre-wrap',color:'#475569'}}>{issue.message}</p>
    </details> : <div key={`${index}-${issue.title}`} style={{border:'1px solid #E2E8F0',borderRadius:10,padding:14,background:'#FAFAFA'}}>
      <span style={{fontSize:11,fontWeight:700,color:(issue.owner==='RankPilot'||issue.owner==='Optimización editorial')?'#4338CA':'#92400E'}}>{issue.owner}</span>
      <h3 style={{fontSize:15,margin:'5px 0'}}>{issue.title}</h3>
      <p style={{fontSize:13,lineHeight:1.6,margin:'6px 0 10px',color:'#475569'}}>{systemManaged && ['RankPilot','Optimización editorial'].includes(issue.owner) ? (isRunning ? 'Espera a que termine la revisión. Puedes cerrar esta pestaña y consultar el resultado al volver.' : recoveryInstructions) : issue.action}</p>
      {!(systemManaged && ['RankPilot','Optimización editorial'].includes(issue.owner)) && !isRunning && <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',marginTop:8}}>
        <button type="button" disabled={busy} onClick={()=>onResolve(issue.destination==='review'?'retry-review':issue.destination,issue.message)} style={{color:'#4338CA',background:'#EEF2FF',border:'1px solid #C7D2FE',borderRadius:7,padding:'7px 12px',fontWeight:600,cursor:'pointer',fontSize:13}}>
          {issue.destination==='retry-selection'?(busy?'Reintentando…':'Reintentar selección de asuntos'):issue.destination==='retry-review'||issue.destination==='review'?(stale?'Revisar correcciones guardadas':'Preparar documentos'):issue.destination==='period'?'Ajustar periodo de investigación':issue.destination==='ranking'?'Verificar ranking oficial':issue.destination==='lawyers'?'Ajustar abogado en Studio':issue.destination==='wizard'?'Ajustar asunto en Studio':'Ajustar este pendiente'} →
        </button>
      </div>}
      <details open style={{fontSize:13,lineHeight:1.65,marginTop:10}}>
        <summary style={{cursor:'pointer',color:'#475569',fontWeight:500}}>Detalle de la observación</summary>
        <p style={{whiteSpace:'pre-wrap',marginBottom:0,marginTop:6,color:'#334155'}}>{issue.message}</p>
      </details>
    </div>)}</div>
    {stale && <details style={{marginTop:16,fontSize:13,lineHeight:1.6}}><summary style={{cursor:'pointer'}}>Ver hallazgos de la versión anterior</summary><p>Se conservan como historial; falta comprobar cuáles siguen vigentes.</p><ul>{(data.final_artifact_review.judge?.defects || []).map((d:any,i:number)=><li key={i}>{d.message}</li>)}</ul></details>}
    {!stale && warnings.length>0 && <details style={{marginTop:16,fontSize:13,lineHeight:1.6}}><summary style={{cursor:'pointer'}}>Otras observaciones ({warnings.length})</summary><ul>{warnings.map((w,i)=><li key={i}>{w}</li>)}</ul></details>}
    {!available && !approved && !job?.nextAction && <p style={{fontSize:13,lineHeight:1.6,color:'#475569',marginBottom:0}}>{systemManaged && !humanCount ? isRunning?'RankPilot continuará automáticamente. Puedes cerrar esta pestaña.':recoveryInstructions : issues.some(issue=>issue.destination==='retry-selection') ? 'Pulsa «Reintentar selección». RankPilot repetirá esa etapa y continuará con el Audit y la revisión del Word si la selección supera la comprobación.' : 'Guarda tus cambios y pulsa «Preparar documentos». Se conservará el avance vigente y se crearán los Word con las observaciones que queden.'}</p>}
  </section></>;
}

export function ReadableAudit({letter,label,actions}:{letter:any;label:string;actions?:React.ReactNode}) {
  const sections=[['executive_assessment','Evaluación ejecutiva','Lectura inicial'],['next_steps','Próximos pasos','Recomendaciones antes de presentar'],['evidence_gaps','Exclusiones y reservas','Comparación con los asuntos seleccionados'],['portfolio','Portafolio seleccionado','Asunto insignia, selección y reservas'],['leadership','Liderazgo y atribución','Evaluación de cada abogado']];
  return <article style={{background:'#fff',padding:'clamp(16px, 3vw, 32px)',borderRadius:14,border:'1px solid #E2E8F0',color:'#0F172A',overflowWrap:'anywhere'}}>
    <p style={{fontSize:12,fontWeight:700,color:'#4338CA',margin:0}}>STRATEGIC AUDIT · {label}</p>
    <h2 style={{fontSize:26,margin:'8px 0'}}>Tu estrategia, por partes</h2>
    <p style={{fontSize:14,lineHeight:1.6,color:'#64748B',marginBottom:24}}>Empieza por la evaluación y los próximos pasos. Abre cada sección para consultar la evidencia completa.</p>
    {sections.map(([key,title,subtitle],index)=><details key={key} open={index===0 || index===1} style={{borderTop:'1px solid #E2E8F0',padding:'18px 0'}}>
      <summary style={{cursor:'pointer',fontSize:17,fontWeight:700}}>{title}<span style={{display:'block',margin:'5px 0 0 18px',fontSize:12,fontWeight:400,color:'#64748B'}}>{subtitle}</span></summary>
      <div style={{fontSize:15,lineHeight:1.8,maxWidth:'72ch',marginTop:16}}>{key==='next_steps' && actions ? actions : String(letter[key] || 'Sin contenido en esta revisión.').split(/\n\s*\n|\n(?=\d+[.)]\s)|(?<=\.)\s+(?=\d+[.)]\s)/).filter(Boolean).map((block,i)=><p key={i} style={{whiteSpace:'pre-wrap',margin:'0 0 16px',paddingLeft:/^\d+[.)]/.test(block)?12:0,borderLeft:/^\d+[.)]/.test(block)?'3px solid #C7D2FE':undefined}}>{block}</p>)}</div>
    </details>)}
  </article>;
}
