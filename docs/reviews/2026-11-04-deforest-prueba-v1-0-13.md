# Prueba nueva de DeForest con v1.0.13

## Resultado

No superada. La extracción recuperó los 32 asuntos, pero la comprobación de selección se detuvo antes del desarrollo y del Audit. No hay pareja Word aprobada ni una entrega autónoma nueva.

- Expediente: `045e490a-0b5d-43eb-a086-b2dd343675f4`.
- Trabajo: `4cc33c81-e6d8-49b4-a378-08b8d0f211e0`.
- Estado: Draft, revisión 2; trabajo failed, `SELECTION_REJECTED`.
- Motor y worker fijos: `e6d863bc41f5078cfa4acbfd0f21806ae542cb14`, huella `0273edfd562a386649a478c9925ce77579e80ebeab6aa14921f42076cda613ac`.
- Frontend: `03d3d581150c24851f4827200b128bb1929f9045`, cambio de documentación con código funcional idéntico. Vercel success.

## Recorrido desde la sesión de Ángela

Se eligió primero DeForest porque el último intento agotó las rondas y tuvo mayor consumo. Se mantuvo el original, la práctica Labour & Employment, Chambers Latin America/Mexico, ranking sin confirmar y los mismos objetivos de reconocimiento/profundidad institucional.

La primera subida falló por `net::ERR_CONNECTION_TIMED_OUT`; el estado del almacenamiento respondió después y un reintento ordinario reutilizó el mismo borrador. La modalidad A inicial resultó inadecuada: el original es un formulario de Leaders League y el destino es Chambers. El aviso dio una instrucción concreta de usar Documentos Dispersos. Se siguió esa instrucción en la interfaz, con la misma calibración y el mismo archivo. La validación del directorio ocurrió antes de llamadas de conciliación; no debe contarse como otra extracción de OpenAI.

El control nativo de Chrome agotó dos plazos de revisión automática de permisos durante el selector. Fue un timeout, no un rechazo por seguridad. Se consultó el estado al usuario y una lectura posterior recuperó el control. La acción pendiente no se había ejecutado. No se hicieron confirmaciones a ciegas ni se reinició el caso.

La única extracción con modelos recuperó 32 asuntos y mostró una decisión de permiso pendiente. Se continuó sin inventar autorización, conforme a la explicación de que el asunto puede conservarse exclusivamente en la sección confidencial. Se guardó la revisión ordinaria sin cambiar hechos, importes, roles ni fuentes. Se pulsó Revisar y generar una sola vez. No se inició Ramos.

## Causa del bloqueo editorial

El revisor de selección pidió ajustar un descriptor sectorial no esencial y citó la fila completa del registro del mismo cliente. Esa cita sí existe literalmente en `confidentialityEvidence.client_register`. El validador buscaba únicamente en la narrativa y campos del asunto, por lo que la declaró no vinculada. La historia de fallos quedó con un lote vacío y no permitió la reparación acotada. El proceso se detuvo sin declarar aprobada la selección.

Además, reapareció la comparación entre una etiqueta sectorial del registro y una característica de la fuerza laboral. La instrucción de comparar atributos equivalentes se había aplicado al revisor final, pero no de forma común a todos los roles anteriores. La comprobación dirigida previa no revisó esta etapa ni podía demostrar el recorrido completo.

No se modificó el código ni el expediente durante la ejecución. El trabajo terminado conserva su rechazo y su consumo. El hash de la instantánea inicial coincide con el trabajo y con la fuente actual; no se alteró la evidencia para pasar.

## Consumo conocido

| Etapa | Tokens |
| --- | ---: |
| Conciliación de una extracción | 55.711 |
| Estratega | 72.069 |
| Revisor de selección | 66.094 |
| Total editorial | 138.163 |
| Total de esta prueba registrado | 193.874 |

La extracción realizó siete llamadas de bloques de una única fuente; no fueron siete cargas. El trabajo editorial registró dos llamadas, sin reparación posterior ni reinicios. Estos registros no son una factura global del proveedor. El permiso dirigido anterior de 40.000 tokens corresponde a otra comprobación y no se reutilizó.

## Correcciones posteriores con v1.0.14

Una vez terminado el intento se prepararon cambios genéricos:

1. Vincular el diagnóstico de selección con la fila original del registro del propio cliente, de forma literal. No aceptar filas ajenas, citas reconstruidas ni usar ese permiso como sustituto de la evidencia de trabajo jurídico del selector. Mantener el rechazo hasta una corrección y relectura independiente.
2. Compartir el criterio de mismo sujeto/atributo/evento entre estrategia, selección, desarrollo, Audit, reparación y revisión final. No fijar clientes ni resultados por nombre.
3. Registrar desde la ingestión la política ya utilizada por el motor para el destino confidencial de permisos pendientes. La pantalla pedía confirmar publicación después de permitir continuar sin ella porque esa política solo se persistía al completar la entrega. El cambio rige nuevos guardados de ingestión; no modifica el expediente histórico probado ni confirma consentimiento.

Validación local posterior: 429 pruebas Python correctas, 456 Node correctas y una omitida, TypeScript y compilación de producción correctos. La regresión del diagnóstico real conserva los 32 checks y muestra el cambio de cita no vinculada a reparación acotada permitida, con selección todavía rechazada. Los tests simulados verifican corrección y relectura, y que un hallazgo repetido se detenga antes de redactar. Cero llamadas nuevas a OpenAI para estas comprobaciones.

Estas correcciones no convierten esta prueba fallida en aprobada. No se reanudó el trabajo, se amplió presupuesto ni se compró otra extracción. Falta comprobar una ejecución completa con la nueva versión fija.

Evidencia privada fuera de Git: `scratch/autonomia-v1-0-13-deforest-2026-11-04`, con protocolo, versión, acciones UI, observaciones, snapshots, ledger, recibo de consumo/integridad y replay de la cita. No contiene una entrega final nueva.

## Publicación de la corrección posterior

v1.0.14 publicada en dev/main: `72ddfc0a3156e5acd4cdf3157fa85a649caf6470`. Motor `dep-dblncftg1s2s73d5hqt0` y worker `dep-dblncftg1s2s73d5hr5g` LIVE; health online con mismo commit y huella `eec6821f2a0b51b5059b5b06087c19e804d2d1028601bc4895431a528477a7b2`. Vercel informa success para `dpl_5yBfwHLYu9P8R9gTaSYFaMEiaraa`. No se confirmó un run nuevo de Actions remoto.

No hubo trabajos activos antes de publicar. El único intento de DeForest mantiene el fallo histórico. Publicar la corrección no equivale a ejecutar ni aprobar otra prueba. No se adquirieron más llamadas de generación después de detenerse la selección.
