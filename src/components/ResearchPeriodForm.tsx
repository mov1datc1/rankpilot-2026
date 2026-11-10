'use client';
import {useState} from 'react';
export function ResearchPeriodForm({from,to,busy,onFrom,onTo,onSave,onClose}:{from:string;to:string;busy:boolean;onFrom:(value:string)=>void;onTo:(value:string)=>void;onSave:()=>Promise<void>;onClose:()=>void}) {
  const [error,setError]=useState('');
  return <section id="studio-research-period" aria-label="Periodo de la convocatoria" style={{padding:20,border:'1px solid #CBD5E1',borderRadius:12,scrollMarginTop:100}}>
    <h3>Periodo de la convocatoria</h3>
    <p>Indica las fechas de actividad que pide el directorio. Consúltalas en su convocatoria; no uses fechas estimadas.</p>
    <form onSubmit={async e=>{e.preventDefault();if(!from || !to || from>to){setError('Indica ambas fechas; el inicio debe ser anterior o igual al final.');return;}setError('');await onSave();}}>
      <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
        <label>Desde <input aria-label="Inicio del periodo" type="date" required disabled={busy} value={from} onChange={e=>onFrom(e.target.value)} /></label>
        <label>Hasta <input aria-label="Fin del periodo" type="date" required disabled={busy} value={to} onChange={e=>onTo(e.target.value)} /></label>
      </div>
      {error && <p role="alert">{error}</p>}
      <p>Guardar actualiza los datos del expediente; no inicia una generación. Los Word ya descargados no cambian.</p>
      <button type="submit" disabled={busy}>{busy?'Guardando…':'Guardar periodo'}</button>{' '}
      <button type="button" disabled={busy} onClick={onClose}>Cerrar</button>
    </form>
  </section>;
}
