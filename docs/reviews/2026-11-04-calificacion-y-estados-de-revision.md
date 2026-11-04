# v1.0.12: calificación de desenlaces y próximos pasos visibles

## Problema y cambio

El intento fijo v1.0.11 terminó rechazado en ambos casos. La captura del usuario muestra que DeForest pide pulsar una acción ausente aunque el supervisor ya detuvo la revisión. El usuario necesita conocer su siguiente acción y si esperar sirve. La revisión activa ahora pide esperar; una pausa terminal explica que esperar no reanudará, conserva hallazgos y acceso al Audit interno disponible, y deshabilita generar en el intento sin cambios. No se anuncia un plazo ni reintento que no exista.

Se comprobó otro fallo: al vincular un hallazgo sectorial a su campo generado se perdía su campo semántico y la reparación podía quedar sin ruta. Se conserva `source_field_path`. Esto corrige el enrutamiento; no demuestra por sí solo la calidad de un nuevo veredicto del modelo.

Para un resultado de fondo que el usuario no puede confirmar, el juez puede proponer limitar las afirmaciones generadas al trabajo procesal separado y acreditado, conservando ambas fuentes y su incertidumbre en el Audit. La autorización de reparación exige dos alternativas literales del mismo asunto, un pasaje procesal/interino distinto, una cita real del documento afectado y evaluación de que el trabajo y selección no dependen del desenlace discutido. El hallazgo permanece crítico; la corrección requiere revisión independiente de la pareja Word. No se infiere victoria, derrota, actividad actual ni identidad.

## Límites y comprobación

- Fuentes, selección, consentimiento, rechazo histórico y límites de gasto intactos.
- Un clic explícito sobre el mismo intento pausado no crea una nueva asignación de reparaciones.
- 419 pruebas Python correctas; 455 Node correctas y una omitida; TypeScript correcto.
- Regresiones offline y respuestas simuladas: ninguna llamada nueva a OpenAI, extracción, generación ni reanudación de los dos trabajos.
- No existe todavía una prueba autónoma aprobada de esta versión. No presentar el cambio como cierre de los documentos ni como cumplimiento total de los comentarios de Ángela.

## Publicación

Compilación de producción correcta con acceso de red para las fuentes. La compilación inicial no pudo descargar las fuentes de Google en el entorno restringido; no fue un error de tipos. Pendiente registrar commit y estado remoto verificados.
