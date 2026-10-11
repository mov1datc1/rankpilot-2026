'use client';
import {useEffect,useState} from 'react';

export function PreparationProgress({progress,light=false}:{progress:{current:number;total:number;startedAt?:string;waiting?:boolean};light?:boolean}) {
  const [now,setNow]=useState<number|null>(null);
  useEffect(()=>{setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  const started=Date.parse(progress.startedAt || '');
  const seconds=now!==null && Number.isFinite(started) ? Math.max(0,Math.floor((now-started)/1000)):null;
  const elapsed=seconds===null ? '' : ` · ${Math.floor(seconds/60)} min ${seconds%60} s transcurridos`;
  return <div style={{marginTop:12,color:light?'#E0E7FF':'#475569',fontSize:13}}>
    <p style={{margin:'0 0 8px'}}>{progress.waiting?'En espera · ':''}Etapa {Math.min(progress.current+1,progress.total)} de {progress.total}{elapsed}</p>
    <progress aria-label="Etapas completadas" max={progress.total} value={progress.current>0?progress.current:undefined} style={{display:'block',width:'100%',height:7,accentColor:light?'#38BDF8':'#4338CA'}} />
    <p style={{margin:'8px 0 0',fontSize:12}}>Puedes salir y volver. La preparación continúa y el avance queda guardado.</p>
  </div>;
}
