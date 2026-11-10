export type EditorialNextAction={
  kind:'wait'|'answer'|'continue'|'download'|'review_changes'|'refresh';
  title:string;
  description:string;
  automatic:boolean;
};

/** Describe a real transition, not a promise that another click buys retries. */
export function editorialNextAction(job:any,options:{sourceMatches?:boolean|null;canResume?:boolean;hasObservations?:boolean;documentsAvailable?:boolean}={}):EditorialNextAction {
  const action=(kind:EditorialNextAction['kind'],title:string,description:string,automatic=false)=>({kind,title,description,automatic});
  if(options.sourceMatches===false)return action('review_changes','Revisa los cambios guardados',
    'Las fuentes cambiaron desde este intento. Revisa los datos actuales y prepara esa versión; los documentos anteriores todavía no incluyen estos cambios.');
  const active=['queued','running'].includes(job.status);
  const lastDecision=[...(job.ledger || [])].reverse().find(e=>e.supervision)?.supervision;
  if(active) {
    if(lastDecision?.action==='repair')return action('wait',
      lastDecision.repair_strategy==='source_reconstruction'?'Reconstruyendo los campos pendientes desde sus fuentes':'Corrigiendo los campos pendientes',
      'RankPilot conserva lo ya completado, corrige los campos señalados y comprobará el resultado. No necesitas volver a pulsar «Preparar documentos». Puedes cerrar esta pestaña y volver después.',true);
    return action('wait',job.status==='queued'?'Preparación en espera':'Preparación en curso',
      'El trabajo continuará automáticamente. Puedes cerrar esta pestaña y volver; no necesitas iniciar otro intento.',true);
  }
  if(job.status==='completed' || options.documentsAvailable)return action('download',`Documentos disponibles · ${options.hasObservations?'con observaciones':'sin observaciones'}`,options.hasObservations?'Abre «Descargar» para obtener el Submission y el Audit. Revisa las observaciones antes de presentarlos.':'Abre «Descargar» para obtener el Submission y el Audit. La revisión no dejó observaciones pendientes.');
  if(lastDecision?.action==='needs_input' || job.issue?.owner==='user')return action('answer','Responde los datos pendientes',
    'Abre la confirmación indicada abajo y guarda tu respuesta. Después pulsa «Preparar documentos» para continuar con la información actualizada.');
  if(options.canResume)return action('continue','Continúa la preparación guardada',
    'Pulsa Continuar preparación. Se conservarán las fuentes, el avance y el consumo registrado; no vuelvas a cargar el documento.');
  if(lastDecision?.reason==='token_budget' || ['TOKEN_BUDGET','EDITORIAL_BUDGET_REQUIRED'].includes(job.issue?.code))return action('refresh','Consulta el avance guardado',
    'Este intento conserva un aviso de capacidad anterior. Pulsa «Actualizar estado» para comprobar si ya están los documentos o está disponible «Continuar preparación». Consultar el estado no inicia otra generación.');
  if(job.status==='indeterminate' || lastDecision?.reason==='provider_outcome_unknown')return action('refresh','Comprueba el resultado de la preparación',
    'Aún no se pudo confirmar el resultado de una operación. Pulsa «Actualizar estado» para consultar el avance guardado. Esta consulta no repite la operación ni consume tokens de generación.');
  return action('refresh','Comprueba el avance guardado',
    'Todavía no están disponibles ambos archivos. Pulsa «Actualizar estado» para consultar el resultado o las opciones de continuación. Conservamos tus fuentes y el avance; esta consulta no inicia otra generación.');
}
