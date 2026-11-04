# Resultado de la prueba autónoma con versión fija

La prueba NO acredita el cierre completo de RankPilot para Ángela. DeForest completó el recorrido técnico y obtuvo sus dos Word aprobados sin intervención técnica, pero la inspección posterior encontró residuos editoriales que los validadores dejaron pasar. Ramos quedó bloqueado por una falsa incompatibilidad entre una descripción histórica y su actualización posterior. No se rescataron los casos durante la prueba.

## Condiciones y versión

Jonathan autorizó expresamente dos ejecuciones nuevas desde los originales privados, con llamadas normales a OpenAI, sin cambios de código, ampliaciones de presupuesto ni correcciones manuales durante el recorrido. Se usó Chrome en la sesión de Ángela. Cada original se procesó una vez; se confirmó el formulario ordinario conservando los hechos y permisos pendientes. No hubo escrituras SQL ni cambios de veredictos. Solo cambiaron registros locales de observación y documentación.

- Frontend y worker: `02d2b02d2aa7e18b15b659634e59cdb9f48f6d5c`.
- Motor: `4fe391b2d655d7fb4b2c81603c9eb7fc87f702ce`, huella `dbf1fc11f2292d17cb855ca97324b3b9a8a3af0feaba73ab01b0bf9704f797b6`.
- Vercel: `dpl_C1v3zPG61Y98DkwVHMjyoGYtvFHP`, Ready.
- Worker Render: `dep-dbl6denb9u1s73fnl8fg`, LIVE.
- Motor Render: `dep-dbl68q142hec739781vg`, LIVE.
- Límite normal de trabajo: 1.200.000 tokens al inicio de cada etapa; no es un límite duro de facturación del proveedor. Un reintento por etapa/cursor entre versiones, dos rondas máximas de reparación de Word y pausa ante resultados desconocidos. Sin ampliaciones.

Las observaciones del recorrido corresponden a la tarde del 3 de noviembre de 2026 en México; los recibos técnicos usan UTC del 4 de noviembre.

## Resultado por caso

| Caso | Resultado técnico | Calidad y aceptación |
| --- | --- | --- |
| DeForest | 32 asuntos; selección de 20 confidenciales; revisión 4; trabajo completed; Submission y Audit exactos aprobados por el sistema | No se concede cierre editorial: la inspección del Word detectó voz auditora y una petición tímida que los validadores no señalaron. Dos advertencias adicionales del juez final. |
| Ramos | 33 asuntos; validación guardada conservando la duda; generación deshabilitada; sin trabajo editorial iniciado | No pasó el recorrido autónomo: un estado histórico y una actualización explícita de 2024 se trataron como alternativas incompatibles. No se rellenó la respuesta ni se forzó la generación. |

DeForest se creó como expediente `569aa7e4-d34d-4cd1-b683-85ac202b54c3`, trabajo `1002b90d-2913-4122-8afd-a2b02324009a`. Ramos: expediente `08a1716c-9603-4e64-a234-46a47732f98f`. Los anteriores expedientes asistidos y aprobados no se modificaron.

## DeForest y descargas

La extracción base recuperó 32 asuntos y el nombre de firma salió limpio. La conciliación secundaria rechazó evidencia no literal; el motor conservó automáticamente la extracción determinista y lo dejó advertido. Se comprobaron 103 anclas narrativas largas contra el original, sin cambios de texto. Esto no equivale a afirmar conciliación secundaria perfecta ni aprobación de todos los hechos de la fuente.

La validación inicial se recorrió sin corregir redacciones ni nombres y sin conceder el permiso pendiente. El flujo normal inició una sola preparación, seleccionó, desarrolló, validó/reparó localmente, redactó el Audit, revisó la pareja Word, aplicó una reparación acotada y revisó la pareja nueva. Todas las etapas guardadas pertenecen al mismo worker `02d2b02`. No hubo reanudación manual, cambios de versión ni extensiones. La fuente del trabajo sigue intacta y la aprobación está vinculada a los inputs actuales.

Se descargaron ambos Word desde la aplicación autenticada. Sus bytes coinciden con los aprobados:

- Submission SHA256 `2e7bf996f060318ea244a8919a335cc8e918f7cd7acd1dbadc1ffbf52daf7ec1`.
- Audit SHA256 `03ac63476a9fddb5fa61ad195f00e495b21c063a60dee76ad5d15c8a6ce96a29`.

Se renderizaron e inspeccionaron todas sus páginas: Submission 28 y Audit 3. No se observaron recortes, solapamientos ni caracteres fuera de página. Se conservaron las continuaciones de tablas de la plantilla y los bytes de los archivos descargados; no se retocaron.

La aprobación automática no satisface por sí sola la aceptación editorial pedida por Jonathan. Se observaron:

- B9, páginas 3–4: expresiones como `identified in the supplied biography`, `The supplied profile describes` y `The supplied materials do not describe`. Son comentarios sobre el expediente en una biografía pública.
- C2, página 6: `respectfully seeks` y `The submission also identifies`, en lugar de una defensa directa de la práctica.
- E8, páginas 9, 19 y 20: referencias al campo de estado o a resultados que la fuente no declara. La incertidumbre debe expresarse sobre el asunto, sin voz de auditor.
- El juez final mantuvo advertencias por periodo de investigación no informado y por normalizar una razón social con una grafía no atestiguada. No se pidió al usuario elegir una identidad corporativa ni se cambiaron sus fuentes.

El preflight local devolvió cero rutas con voz auditora y el juez final aprobó. Esta diferencia frente a la inspección documenta una brecha real de detección; no se ocultó ni corrigió manualmente para convertir el resultado en un pase.

## Ramos y el bloqueo de entrada

El sistema contrapuso un estado histórico con una sección expresamente rotulada como actualización posterior del mismo asunto. No se trataba simplemente de dos afirmaciones simultáneas incompatibles. Se dejó la pregunta sin contestar, se guardó la validación ordinaria y la interfaz deshabilitó Revisar y generar. No se compró una selección, desarrollo ni revisión Word para intentar rodear ese bloqueo. No existe pareja final nueva de Ramos en esta prueba.

Debe corregirse la distinción entre evolución cronológica y contradicción en la conciliación de fuentes, conservando ambos pasajes literales y su procedencia. No resolverlo borrando el histórico, inventando consentimiento o rellenando respuestas del usuario mediante SQL.

## Consumo y operación

| Registro | Tokens disponibles en el historial |
| --- | ---: |
| Selección DeForest | 94.655 |
| Desarrollo y reparaciones DeForest | 104.969 |
| Audit inicial y posterior DeForest | 140.767 |
| Dos revisiones de pareja Word DeForest | 157.563 |
| Total del trabajo editorial DeForest | 497.954 |
| Conciliación de extracción Ramos, siete llamadas normales de una sola extracción | 68.184 |

No sumar registros repetidos del checkpoint como consumo adicional. Los 497.954 tokens de DeForest excluyen extracción. La conciliación secundaria fallida de DeForest no persistió su consumo en el source report: no se debe interpretar esa ausencia como cero ni presentar 566.138 como factura total de ambos casos. No se hicieron llamadas de reparación o revisión adicionales después de terminar.

Las métricas observadas no muestran presión de memoria: máximos aproximados de 195 MiB en motor y 237 MiB en worker, sobre 512 MiB. El log de error observado corresponde a la conciliación secundaria rechazada de DeForest, seguida de fallback y respuesta HTTP correcta. No se infiere ausencia absoluta de errores de una consulta vacía. Las etapas editoriales se ejecutaron en Render; Vercel sirvió el frontend y las descargas. Lectura final de la cola: ningún trabajo queued, running o indeterminate.

## Estado de cierre

No anunciar que ambos casos funcionan al 100%. Se acreditó un recorrido técnico autónomo de DeForest con descargas exactas, pero quedaron defectos editoriales observados fuera del veredicto automático; Ramos no superó la validación inicial. El siguiente trabajo es reproducir esas dos familias de fallos sin OpenAI y corregir sus controles de raíz antes de solicitar otra prueba pagada. No modificar ni rescatar estos expedientes para reclasificar esta prueba como exitosa.

La evidencia privada completa permanece ignorada en `scratch/autonomia-2026-11-03`: autorización y freeze, snapshots, ledger, hashes, métricas, capturas, descargas y QA. No publicar originales, Word, pasajes privados o credenciales en Git. No se envió ningún mensaje a Ángela.
