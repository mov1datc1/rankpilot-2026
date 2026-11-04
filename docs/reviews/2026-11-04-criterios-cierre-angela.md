# Cierre verificable del recorrido de Ángela

El objetivo es que una usuaria termine desde sus originales, comprenda el estado del borrador y obtenga la pareja de documentos mediante el flujo normal. Una compilación correcta o un Word retocado no satisface este criterio. No se añade una derivación a soporte como sustituto del flujo.

## Observaciones y comprobación exigida

Fuentes de criterios: `angela-feedback-consolidado-2026-10-08.txt`, `angela-editorial-method-2026-10-09.txt` y `angela-feedback-ramos-castillo-2026-10-27.txt`. Sus valoraciones históricas no prueban la versión actual ni aportan hechos a los expedientes nuevos.

| Petición | Comprobación para cerrar | Estado de la evidencia actual |
| --- | --- | --- |
| Reconstruir asuntos con descripción, updates, estado y resultado | Conservar pasajes originales y actualizaciones; no confundir evolución con contradicción ni inventar actividad | Regresiones de conciliación y optimización individual; último Ramos superó el falso conflicto cronológico. Nueva pareja completa aún pendiente. |
| Selección comparativa e insignia coherentes | Cada ID tiene disposición y fundamento; mismo núcleo e insignia en Studio, Audit y Submission | Ambos registros recientes tienen 33/32 comprobaciones semánticas supported y cero notas de aprobación por agotamiento. No prueba calidad universal de jerarquización. |
| Candidaturas y atribución individual | El liderazgo corresponde a la persona y al asunto; categoría compatible; preservar experiencia aportada | Regresiones de atribución, categorías y reparación de candidato. Falta comprobar íntegramente la nueva pareja. |
| B10/C2 y asuntos sustantivos, sin voz auditora | Preservar mecanismo jurídico, escala y resultado acreditado; redacción proporcional a evidencia | Validadores de desarrollo y preflight Word; últimas corridas necesitaron reparaciones de omisiones. No afirmar cierre editorial completo. |
| Monedas, valores y confidencialidad | Separar conceptos y monedas; identidades/datos restringidos fuera de secciones públicas | Contratos y reparaciones observadas; la futura pareja debe superar otra revisión exacta. |
| Objetivo, ranking verificado y candidaturas diferenciados | Conservar objetivo explícito sin presentarlo como ranking; limitaciones transparentes | Implementado y con contratos. No importar objetivos históricos ausentes del original actual. |
| Borrador comprensible y entrega completa accesible | Distinguir guardado, revisión y aprobado; datos genuinos con acción; reparación generada dentro del flujo | La distinción está implementada. La pausa terminal sigue siendo fallo de aceptación para estos casos; consultar Audit no lo cierra. |
| No bucles ni aprobaciones falsas | Respeto de consumo acumulado, máximo de rondas, rechazo persistente y fuentes intactas | Se conserva supervisor. v1.0.13 elimina tres vías heredadas de aprobación de selección al agotarse reparación. |
| Audit y Submission reconciliados | Revisión independiente de la pareja Word exacta y descarga ligada a sus hashes | Implementado. Ninguna pareja reciente aprobada; pendiente nueva prueba fija de principio a fin. |

## Cambios concretos de v1.0.13

1. La selección no se aprueba por tener <=20 asuntos y un insignia dentro del núcleo cuando sigue semánticamente rechazada. Se eliminan el bypass del nodo, de la reanudación y de la arista. La repetición se detiene sin nuevas llamadas ni redacción. Las dos corridas recientes NO usaron ese bypass: 33/32 checks supported, cero notas qualified; no atribuirle sus bloqueos finales.
2. La calificación de un desenlace excesivo se puede comprobar contra campos de borrador explícitos. Antes solo podía verificarse contra Word renderizado, aun cuando la ruta editorial era anterior. Un Word presente siempre prevalece: nunca se sustituye por el borrador viejo para pasar una revisión.
3. Si el diagnóstico de desenlace está etiquetado facts, se vincula al documento generado solo cuando su cita existe inequívocamente en uno de los dos textos. Sin ubicación única, evidencia propia completa y evaluación de que el trabajo/selección se sostienen, no obtiene permiso de reparación. El rechazo sigue crítico hasta revisión independiente.

## Protocolo de comprobación final

Congelar código y despliegues antes de empezar. Una ejecución nueva por original, desde la sesión de Ángela y bajo los límites normales. No reanudar los rechazos antiguos, ampliar presupuestos, editar fuentes o corregir código mientras se ejecuta. Las respuestas son únicamente hechos acreditados; una incertidumbre de fondo no se responde por intuición. Vigilar consumo y cada etapa. Si el sistema necesita intervención técnica o repite un hallazgo hasta detenerse, la prueba falla: no retocarla para declararla autónoma.

Revisar todas las páginas y hechos decisivos de los Word aprobados, y comprobar la descarga exacta. Si una observación es preferencia estratégica legítima, documentar el criterio y la evidencia; no fijar por nombre un resultado esperado. Registrar por criterio lo observado, lo pendiente y consumo conocido. Una nueva prueba pagada no se atribuirá a autorizaciones puntuales agotadas de trabajos anteriores.

## Validación local de v1.0.13

424 pruebas Python correctas; 455 contratos Node correctos y una prueba omitida; TypeScript correcto. Las regresiones nuevas prueban rechazo repetido con núcleo/insignia válidos sin redacción posterior ni llamadas adicionales, reutilización agotada sin llamada, reparación de borrador con fuente propia y rechazo de fallback a borrador al existir Word real, y ubicación inequívoca del diagnóstico facts. Todo sin OpenAI ni escrituras a los expedientes.
