# v1.0.20 — Privacidad pública antes de generar Word

La revisión autorizada del último intento confirmó que v1.0.19 retiró la frase editorial rechazada. La pareja nueva no fue aprobada: el juez identificó cuatro combinaciones de información confidencial en tres campos públicos, dos biografías y C2. Se conservaron fuentes, selección y consumo acumulado; no se inició el recorrido desde cero porque no se cumplió la condición del usuario.

El control previo exigía dos métricas coincidentes. Dejaba pasar una cifra exacta acompañada del contexto de adquisición, procedimiento o investigación sensible, o vinculada por el soporte individual al mismo asunto confidencial.

La corrección general:

- Detecta también una métrica original más un contexto de caso compartido, o la relación explícita de la candidatura con su asunto confidencial. Reúne todos los campos afectados antes de renderizar. Una cifra genérica aislada, una fecha o una cita normativa no establece ese riesgo.
- Distingue monedas conocidas: la misma cifra en MXN y USD no demuestra coincidencia. Un símbolo monetario ambiguo no se convierte en USD.
- Conserva las fuentes afectadas en el contrato de reparación. Generaliza la huella del caso solo en B9/B10/C2; las cifras, actuaciones, atribuciones y demás evidencia exacta permanecen en E.
- Verifica la condición de privacidad sobre el resultado del delta. Si la combinación subsiste pese a cambiar el párrafo, permite el único reintento local previsto, restringido a los campos todavía fallidos. Se conservan ambos consumos y los campos ya corregidos; no aumenta el techo global ni habilita aprobación sin juez final.

El replay local del borrador real, sin llamadas al modelo ni escrituras al caso, detecta los cuatro riesgos en los mismos tres campos señalados por la revisión independiente. No incluye fuentes ni identificadores privados en el repositorio público.

Pruebas Python: 468 correctas. Los casos ficticios cubren adquisición con una sola cifra de plantilla, amparo o investigación con una cuantía, monedas distintas, preservación de narrativas confidenciales y una corrección ineficaz seguida por un único delta residual. 474 contratos Node correctos y uno omitido. Los cambios funcionales de esta versión están en el motor Python. El replay local por sí mismo no constituye aprobación; las comprobaciones reales posteriores se documentan a continuación.


## Publicación y validación real

Código fe77f03dc68ac8e0ac6e7915628b3c7fdde47e8a publicado en dev y main. Motor y worker verificados LIVE con esa revisión y huella 1b80516acaa94e4d2c89dc6d1aac564d76206fe6075caf9fa32cf2d0d094625d.

La reparación dirigida del intento detenido corrigió los tres campos públicos y aprobó la pareja Word mediante revisión independiente, sin modificar las narrativas confidenciales ni ampliar el límite acumulado. Esto permitió cumplir la condición para una nueva prueba desde cero.

La nueva prueba completa por opción B terminó **completed**, con una sola extracción y un único trabajo. Se usó el mismo original inalterado y la sesión habitual. La validación inicial mantuvo un permiso ausente sin confirmar y conservó ese asunto confidencial. Todos los registros de ejecución acreditan el mismo worker fe77f03; no hubo cambios de código, fuentes o textos manuales durante la prueba, ampliaciones de presupuesto ni reinicios.

La primera revisión de los documentos detectó una inferencia administrativa indebida en el Audit y dos omisiones de escala económica en asuntos. La supervisión activó la reparación dirigida automáticamente. La siguiente pareja superó la revisión independiente con cero defectos críticos, y la interfaz mostró «Documentos revisados y disponibles» con descarga habilitada. Se conservaron los archivos aprobados y se verificaron sus hashes contra el registro. Selección final: 20 asuntos confidenciales, 11 en reserva y uno excluido.

Consumo conocido de esta prueba nueva: 55.971 tokens de extracción y 826.567 editoriales, total 882.538; no se incrementó el límite normal. La conexión local de monitoreo tuvo timeouts y fue reconectada mediante lecturas del mismo expediente, sin duplicar la generación. La consulta de errores de Render no devolvió entradas en la ventana revisada hasta las 20:06 UTC; esto no acredita ausencia absoluta de errores.

Este resultado acredita un recorrido autónomo completo de esta fuente con esta versión. No demuestra que todos los documentos futuros estén libres de incidencias ni sustituye las pruebas de otros casos. Los datos administrativos todavía pendientes se conservan como observaciones; no son una aprobación del ranking ni una autorización de publicación.
