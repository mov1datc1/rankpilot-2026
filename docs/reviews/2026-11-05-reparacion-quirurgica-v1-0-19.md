# v1.0.19 — Reparaciones con comprobación de la afirmación rechazada

La aceptación anterior terminó sin aprobar la pareja Word. Un párrafo recibió una corrección por omisión, pero conservó una afirmación editorial cuestionada como advertencia. El reparador filtraba esa advertencia y verificaba que el campo cambiara, sin exigir la desaparición de la cita rechazada. El control posterior sí la rechazó; aumentar el número de revisiones completas no corrige esa asimetría.

La nueva implementación:

- Incluye en la reparación advertencias de afirmaciones generadas con fuente, cita y campo concretos, bajo el mismo criterio que impide conservarlas en el artefacto final. Las preguntas de fuente y preferencias sin cita quedan fuera.
- Conserva artifact_quote en el feedback y vincula rejected_quotes al campo donde el texto existe literalmente. Las omisiones pueden resolverse por adición y no convierten automáticamente su cita original en texto prohibido.
- Comprueba después de aplicar el delta que los campos solicitados hayan cambiado y que las citas rechazadas no sobrevivan. Corregir otra oración no satisface esa condición.
- Cuando falla esa condición y hay consumo conocido, permite una sola corrección adicional dentro de esa invocación, con esquema restringido a los campos residuales y sus fuentes. Conserva campos ya corregidos y ambas trazas; no compra otro Audit ni otra revisión completa para descubrir la misma frase.
- Un segundo resultado ineficaz conserva el rechazo. Una interrupción, consumo desconocido, ausencia de contabilidad conocida o una respuesta unresolved impiden comprar ese intento adicional. Los límites globales y la revisión independiente final no se eliminan.
- Detecta antes de renderizar comentarios sobre clasificaciones sectoriales omitidas por supuesta inconsistencia de las fuentes. Las decisiones editoriales pertenecen a la razón interna de la reparación, no a la narrativa del Submission. Los hechos, fuentes, selección, permisos y respuestas guardadas no cambian.

También se aisló el estado del botón de copiar referencia en su componente y se actualizaron los contratos de interfaz para permitir esa acción sin exponer un botón de generación en un intento detenido. La batería completa se ejecutó después de esta modificación.

Validación local: 464 pruebas Python y 474 contratos Node correctos, uno omitido; TypeScript y compilación de producción correctos. Las nuevas regresiones usan casos ficticios y respuestas simuladas: reparación inicial, frase retenida pese a otro cambio, respuesta idéntica, segundo fallo, esquema residual, conservación de campos corregidos, límite previo a una llamada, transporte desconocido y preguntas realmente irresueltas. No se ejecutaron llamadas nuevas a OpenAI ni se alteró el trabajo histórico.

Estos cambios corrigen una causa reproducida de reparación ineficaz. No garantizan que un modelo nunca cometa un error ni equivalen a una aceptación autónoma nueva. Las interrupciones del proveedor y los límites de recursos siguen siendo incidencias técnicas; no deben presentarse como datos que el cliente tenga que inventar o corregir. No se declara aprobada una entrega sin revisión independiente del Word exacto.
