/** Read-only polling. A stalled connection must not freeze the last job state. */
export function observeEditorialJob<T extends {job?:{status:string}}>(options:{
  read:(signal:AbortSignal)=>Promise<T>; apply:(value:T)=>void; onError:()=>void;
  timeoutMs?:number; idleMs?:number; activeMs?:number; retryMs?:number;
}) {
  let disposed=false,inFlight=false;
  let timer:ReturnType<typeof setTimeout>|undefined;
  let controller:AbortController|undefined;
  const refresh=async()=>{
    if(disposed || inFlight)return;
    clearTimeout(timer);inFlight=true;
    const request=new AbortController();controller=request;
    let deadline:ReturnType<typeof setTimeout>|undefined;
    let delay=options.retryMs ?? 10000;
    try {
      const timeout=new Promise<never>((_,reject)=>{deadline=setTimeout(()=>{
        reject(new Error('STATUS_TIMEOUT'));request.abort();
      },options.timeoutMs ?? 12000);});
      const data=await Promise.race([options.read(request.signal),timeout]);
      if(disposed)return;
      options.apply(data);
      delay=['queued','running'].includes(data.job?.status || '') ? (options.activeMs ?? 3000):(options.idleMs ?? 15000);
    } catch {
      if(!disposed)options.onError();
    } finally {
      clearTimeout(deadline);inFlight=false;
      if(!disposed)timer=setTimeout(refresh,delay);
    }
  };
  void refresh();
  return {refresh:()=>{void refresh();},dispose:()=>{disposed=true;controller?.abort();clearTimeout(timer);}};
}
