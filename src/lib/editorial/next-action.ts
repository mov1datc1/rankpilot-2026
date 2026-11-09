export type EditorialNextAction={
  kind:'wait'|'answer'|'continue'|'download'|'review_changes'|'technical_review';
  title:string;
  description:string;
  automatic:boolean;
};

/** Describe a real transition, not a promise that another click buys retries. */
export function editorialNextAction(job:any,options:{sourceMatches?:boolean|null;canResume?:boolean;hasObservations?:boolean;documentsAvailable?:boolean}={}):EditorialNextAction {
  const action=(kind:EditorialNextAction['kind'],title:string,description:string,automatic=false)=>({kind,title,description,automatic});
  if(options.sourceMatches===false)return action('review_changes','Revisa los cambios guardados',
    'Las fuentes cambiaron desde este intento. Revisa los datos actuales y prepara esa versión; el resultado anterior no aprueba los cambios nuevos.');
  const active=['queued','running'].includes(job.status);
  const lastDecision=[...(job.ledger || [])].reverse().find(e=>e.supervision)?.supervision;
  if(active) {
    if(lastDecision?.action==='repair')return action('wait',
      lastDecision.repair_strategy==='source_reconstruction'?'Reconstruyendo los campos pendientes desde sus fuentes':'Corrigiendo los campos pendientes',
      'RankPilot conserva lo ya completado, corrige los campos señalados y comprobará el resultado. No pulses Revisar otra vez. Puedes cerrar esta pestaña y volver después.',true);
    return action('wait',job.status==='queued'?'Preparación en espera':'Preparación en curso',
      'El trabajo continuará automáticamente. Puedes cerrar esta pestaña y volver; no necesitas iniciar otro intento.',true);
  }
  if(job.status==='completed' || options.documentsAvailable)return action('download',`Documentos disponibles · ${options.hasObservations?'con observaciones':'sin observaciones'}`,'Descarga Submission y Audit. Las observaciones indican qué conviene revisar antes de presentarlos.');
  if(lastDecision?.action==='needs_input' || job.issue?.owner==='user')return action('answer','Responde los datos pendientes',
    'Abre la confirmación indicada abajo y guarda tu respuesta. Después pulsa Preparar Submission y Audit para continuar con la información actualizada.');
  if(options.canResume)return action('continue','Continúa la preparación guardada',
    'Pulsa Continuar preparación. Se conservarán las fuentes, el avance y el consumo registrado; no vuelvas a cargar el documento.');
  if(lastDecision?.reason==='token_budget' || ['TOKEN_BUDGET','EDITORIAL_BUDGET_REQUIRED'].includes(job.issue?.code))return action('technical_review','Solicita continuar este intento',
    'La capacidad restante de este intento no alcanza para completar la siguiente operación. Copia la referencia y compártela con quien administra RankPilot para revisar una continuación con presupuesto autorizado. Esperar o pulsar Revisar no añade capacidad; el avance queda guardado.');
  if(job.status==='indeterminate' || lastDecision?.reason==='provider_outcome_unknown')return action('technical_review','Solicita recuperar la operación pendiente',
    'No se pudo confirmar el resultado de una operación. Copia la referencia y compártela con quien administra RankPilot para recuperarla antes de repetirla. El avance queda guardado; no inicies otra generación.');
  return action('technical_review','Recupera la preparación de los documentos',
    'No se pudieron crear los dos archivos. Conservamos tus fuentes y el avance. Copia la referencia y compártela con soporte para recuperar esta operación; no vuelvas a cargar el original.');
}
