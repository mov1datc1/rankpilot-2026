# Capacidad global durante la reparación de selección

La prueba de aceptación de v1.0.14 no aprobó. Se detuvo antes de redactar o generar documentos: una reparación acotada promovió una reserva y dejó 21 asuntos seleccionados, superando el límite de 20. El control estructural rechazó correctamente el resultado. No se reinició el trabajo. Este informe público no contiene identificadores ni información de las fuentes o participantes del expediente; el detalle de aceptación se conserva localmente fuera de Git.

## Corrección general v1.0.15

El contrato de respuesta separa core_corrections y other_corrections. La cantidad máxima de correcciones seleccionadas es 20 menos los asuntos seleccionados no afectados. El modelo recibe contexto comparativo de los seleccionados preservados: corregir la justificación de una reserva no exige promoverla. Puede mantener una reserva con una razón comparativa sustentada, o intercambiar decisiones rechazadas dentro de la capacidad disponible. No cambia decisiones no afectadas, orden o insignia para hacer espacio.

Las propuestas continúan sujetas al control estructural y a una nueva revisión semántica independiente de todas las decisiones. No se amplían presupuestos ni rondas, no se cambian fuentes, no se aprueba un resultado rechazado y no se reactivan trabajos anteriores.

## Validación y límites

433 pruebas Python y 456 contratos Node correctos; un contrato omitido. Tipos y compilación correctos. La primera compilación falló por descarga de Google Fonts con red restringida; la repetición con red terminó correctamente. Regresiones ficticias cubren portafolio lleno, capacidad libre, intercambio acotado y rechazo del asunto número 21, incluyendo reparación seguida por revisión independiente. Un replay local rechaza la propuesta excedida sin generar nuevas llamadas ni alterar estado.

Esto no demuestra una ejecución autónoma aprobada en producción. Siguen pendientes las confirmaciones duplicadas o evitables en ingestión y una acción suficiente para que el usuario culmine ante un fallo interno. No existe una pareja nueva aprobada que revisar visualmente. No anunciar cierre de aceptación ni funcionamiento universal.

## Publicación

Corrección publicada en dev/main: `cd86e0ba1cd4ddf4c60dc701d60049454d4f7912`. Motor y worker confirmados LIVE en ese commit; health online y huella idéntica a local. Vercel reporta success. No se ejecutó otra prueba pagada tras el fallo. El informe específico se retiró del commit no publicado al comprobar que el repositorio es público; aquí solo se registra diagnóstico técnico anónimo.
