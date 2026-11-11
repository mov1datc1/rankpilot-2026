import type {ReviewDestination} from './review-actions';

export type ObservationPresentation = {title:string;explanation:string;action:string;button?:string;destination?:ReviewDestination};
/** Presentation only. Never changes the finding, evidence, availability or verdict. */
export function observationPresentation(finding:any):ObservationPresentation {
  const message=String(finding.message || '');
  const path=String(finding.field_path || '');
  if(finding.code==='MISSING_TEMPORAL_METADATA' || /research_period|falta.*periodo de investigación/i.test(message)) return {
    title:'Falta indicar el periodo de la convocatoria',
    explanation:'No se ha indicado qué fechas cubre esta presentación. Por eso no se pudo comprobar si la actividad de todos los asuntos corresponde al periodo solicitado.',
    action:'Consulta las fechas en la convocatoria del directorio y añádelas si las conoces. Si aún no las tienes, puedes descargar los documentos y comprobarlas antes de presentarlos.',
    button:'Indicar periodo',destination:'period',
  };
  // Only describe spelling variants when the finding itself says they belong to the same matter.
  if(path==='client' && /mismo asunto/i.test(message) && /ambas variantes/i.test(message)) {
    const names=[...message.matchAll(/[“"]([^”"]+)[”"]/g)].map(m=>m[1]);
    return {title:'El nombre del cliente aparece escrito de dos maneras',
      explanation:names.length>=2?`En los documentos aparecen «${names[0]}» y «${names[1]}» para el mismo asunto. Comprueba el nombre que debe usarse; este aviso no confirma por sí solo que sean la misma entidad.`:'Los documentos usan dos formas de escribir el nombre del cliente para el mismo asunto.',
      action:'Puedes descargar los archivos. Antes de presentarlos, utiliza el nombre correcto de forma consistente. No necesitas volver a cargar el original.',button:'Consultar nombre del cliente',destination:'wizard'};
  }
  if(/sin permiso confirmado|publicación sigue pendiente/i.test(message))return {
    title:'Los asuntos sin permiso de publicación se han incluido como confidenciales',
    explanation:'Se han colocado en la sección confidencial porque no consta autorización para publicarlos.',
    action:'Si deben seguir siendo confidenciales, no necesitas cambiar nada. Para presentar alguno como público, confirma primero el permiso del cliente en sus datos.',button:'Consultar permisos',destination:'wizard',
  };
  if(/No se encontró una coincidencia exacta de la firma/i.test(message))return {
    title:'No se pudo confirmar el ranking actual de la firma',
    explanation:'La consulta no encontró una coincidencia exacta en la tabla revisada. Esto no significa que la firma carezca de reconocimiento en otras prácticas o ediciones.',
    action:'Si vas a mencionar un ranking, comprueba la firma, la práctica, el país y la edición en la tabla oficial. Puedes descargar los documentos sin repetir esta consulta.',button:'Consultar ranking',destination:'ranking',
  };
  if(/^Calidad personal candidates\//.test(message) && /categor[ií]a|madurez|seniority|eligibility/i.test(message))return {title:'Revisa el respaldo de la candidatura individual',explanation:'La revisión no pudo confirmar que la categoría propuesta esté suficientemente respaldada por la experiencia aportada.',action:'Comprueba la categoría y la experiencia de este abogado antes de presentar su candidatura. Consulta el detalle para identificar qué evidencia falta.',button:'Consultar abogado',destination:'lawyers'};
  if(/^(?:Caso personal B9:|Perfil B9:|Calidad personal candidates\/)/.test(message))return {title:'Revisa la aportación personal del abogado',explanation:'El perfil necesita precisar la aportación del abogado o conservar información relevante de sus fuentes. Una actuación de la firma no demuestra por sí sola que él la realizara personalmente.',action:'Compara el perfil con sus asuntos y fuentes. Conserva únicamente responsabilidades y resultados que puedas acreditar.',button:'Consultar abogado',destination:'lawyers'};
  if(/^La aceptación editorial no está completa:/.test(message))return {title:'Quedan observaciones de contenido por revisar',explanation:'La revisión encontró aspectos pendientes en la redacción. Los documentos están disponibles, pero este aviso no equivale a una aprobación de su contenido.',action:'Consulta las observaciones específicas de esta lista y revisa los apartados afectados antes de presentar los Word.'};
  if(finding.code==='EDITORIAL_STYLE')return {title:'Revisa la redacción de este apartado',explanation:'La revisión señala texto que necesita un ajuste de estilo o comentarios internos que no deberían aparecer en la presentación.',action:'Abre el detalle y las citas para localizarlo. Puedes corregir el texto en el Word descargado antes de presentarlo.'};
  if(finding.code==='EDITORIAL_OMISSION')return {title:'Falta información relevante en este apartado',explanation:'La revisión señala información de las fuentes que no quedó reflejada con suficiente precisión en el documento.',action:'Compara las citas y el detalle de abajo. Incorpora únicamente la información respaldada por la fuente al revisar el Word descargado.'};
  if(finding.code==='SOURCE_CONFLICT')return {title:'Hay información que necesita contrastarse con la fuente',explanation:'Hay versiones diferentes de un dato en el texto o en sus fuentes. Consulta ambas citas: este aviso no determina cuál es correcta.',action:'Consulta las citas de abajo y confirma el dato antes de presentar el documento. Si no puedes confirmarlo, evita afirmarlo como un hecho.'};
  return {title:'Comprueba este punto antes de presentar',explanation:'La revisión dejó una observación sobre este apartado. Puedes consultar abajo el mensaje completo y las citas disponibles.',action:'Revisa el punto señalado en el Word descargado. No necesitas iniciar otra generación para obtener los archivos.'};
}
