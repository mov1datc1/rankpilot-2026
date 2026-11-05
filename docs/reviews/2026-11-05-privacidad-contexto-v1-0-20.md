# v1.0.20 — Privacidad pública antes de generar Word

La revisión autorizada del último intento confirmó que v1.0.19 retiró la frase editorial rechazada. La pareja nueva no fue aprobada: el juez identificó cuatro combinaciones de información confidencial en tres campos públicos, dos biografías y C2. Se conservaron fuentes, selección y consumo acumulado; no se inició el recorrido desde cero porque no se cumplió la condición del usuario.

El control previo exigía dos métricas coincidentes. Dejaba pasar una cifra exacta acompañada del contexto de adquisición, procedimiento o investigación sensible, o vinculada por el soporte individual al mismo asunto confidencial.

La corrección general:

- Detecta también una métrica original más un contexto de caso compartido, o la relación explícita de la candidatura con su asunto confidencial. Reúne todos los campos afectados antes de renderizar. Una cifra genérica aislada, una fecha o una cita normativa no establece ese riesgo.
- Distingue monedas conocidas: la misma cifra en MXN y USD no demuestra coincidencia. Un símbolo monetario ambiguo no se convierte en USD.
- Conserva las fuentes afectadas en el contrato de reparación. Generaliza la huella del caso solo en B9/B10/C2; las cifras, actuaciones, atribuciones y demás evidencia exacta permanecen en E.
- Verifica la condición de privacidad sobre el resultado del delta. Si la combinación subsiste pese a cambiar el párrafo, permite el único reintento local previsto, restringido a los campos todavía fallidos. Se conservan ambos consumos y los campos ya corregidos; no aumenta el techo global ni habilita aprobación sin juez final.

El replay local del borrador real, sin llamadas al modelo ni escrituras al caso, detecta los cuatro riesgos en los mismos tres campos señalados por la revisión independiente. No incluye fuentes ni identificadores privados en el repositorio público.

Pruebas Python: 468 correctas. Los casos ficticios cubren adquisición con una sola cifra de plantilla, amparo o investigación con una cuantía, monedas distintas, preservación de narrativas confidenciales y una corrección ineficaz seguida por un único delta residual. 474 contratos Node correctos y uno omitido. Los cambios funcionales de esta versión están en el motor Python. La conducta del modelo y la aprobación de una pareja Word siguen necesitando una comprobación real; el replay no constituye aprobación.
