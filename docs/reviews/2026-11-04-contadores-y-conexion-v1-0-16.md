# Contadores de revisión y pérdidas de conexión

La prueba fija de v1.0.15 volvió a detenerse antes de redactar. Conservó 20 seleccionados, por lo que no reapareció el exceso corregido en v1.0.15. El registro contenía dos revisiones semánticas completadas y un contador de tres: una revisión aplazada antes de llamar al proveedor asignaba incorrectamente el valor fijo dos; la revisión posterior lo incrementaba a tres y agotaba antes de tiempo la reparación. No hubo pareja Word aprobada ni otra ejecución pagada después del fallo. Evidencia, consumo e identificadores del expediente se conservan localmente fuera del repositorio público.

## Corrección v1.0.16

- El contador semántico registra revisiones completadas. Un aplazamiento anterior a la llamada, una desconexión o una respuesta no utilizable no inventan revisiones completadas ni reinician ese contador. El límite de tres revisiones reales, las reglas de progreso y el presupuesto acumulado permanecen vigentes.
- Solo un aplazamiento comprobado antes de la llamada recibe la continuación automática existente. Una revisión sin respuesta se clasifica como indisponible, sin comprar otra llamada automáticamente.
- Un timeout o fallo de conexión durante la invocación conserva el historial de consumo conocido y marca una llamada de consumo desconocido. La pérdida de respuesta entre motor y worker recibe la misma distinción. No se atribuye consumo cero a una llamada sin respuesta.
- La agregación conserva la suma conocida y el marcador desconocido; las llamadas ya guardadas no se cuentan dos veces al recibir nuevamente su historial.
- El worker, la recuperación y el inicio manual impiden otra llamada sobre un mismo expediente con consumo desconocido, aunque cambie el despliegue o el estado exterior del trabajo. Los clics repetidos sobre un trabajo activo recuperan su mismo identificador. La observación desde el navegador sigue siendo de lectura y no ejecuta etapas.

Los reintentos del SDK ya estaban desactivados con max_retries=0. Se verificaron las excepciones del SDK instalado y la [documentación oficial de OpenAI](https://developers.openai.com/api/reference/python). La política de no repetir una llamada de resultado desconocido es una salvaguarda de RankPilot; un error de conexión por sí solo no acredita consumo ni éxito del proveedor.

## Pruebas y límites

Pruebas locales simulan aplazamiento antes de llamar, reanudación con el límite real intacto, errores APIConnectionError/APITimeoutError, pérdida de respuesta del motor, historial mixto conocido/desconocido, clic repetido tras perder la respuesta de inicio y bloqueo de reintentos manuales. El recorrido ficticio conserva la selección y llega a su tercera revisión semántica independiente sin recrear el portafolio. Otro control mantiene el rechazo al agotar realmente el límite.

438 pruebas Python correctas, 462 contratos Node correctos y uno omitido; tipos y compilación correctos. El replay local del registro real muestra que el contador adelantado impedía una reparación todavía disponible según las revisiones completadas. No modifica el expediente y no prueba cómo responderá el siguiente modelo ni aprueba documentos.

Esto no acredita cierre autónomo en producción ni una prueba real de desconectar Internet en todos los pasos. Siguen pendientes las confirmaciones evitables o duplicadas y una salida útil para culminar después de un fallo interno. No reactivar intentos terminados ni anunciar que los Word están aprobados.
