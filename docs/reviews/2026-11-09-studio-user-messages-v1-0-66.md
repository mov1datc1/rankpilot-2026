# Submission Studio: mensajes orientados al siguiente paso — v1.0.66

La pantalla conservaba instrucciones de aprobación y botones de versiones anteriores aunque ya permitía descargar documentos con observaciones. Esto confundía la disponibilidad real con la calidad editorial y remitía a acciones con otro nombre.

Se unifican los textos de la barra, el estado de entrega, las descargas, el Audit y el panel lateral. El usuario ve «Preparar documentos», «Continuar preparación» o «Actualizar documentos» según el estado. Cuando los Word están disponibles, se indica «Descargar» y «Ver observaciones» abre los hallazgos sin volver a generar. La recuperación técnica abre «Ver cómo continuar» en vez de dejar un botón deshabilitado. No se anuncia disponibilidad cuando faltan archivos.

Los encabezados de B9 y asuntos usan nombres comprensibles; los mensajes completos y sus citas permanecen en el detalle. Se reconoce también la marca «Contenido editado» al identificar una revisión anterior, conservando compatibilidad con marcas históricas.

Validación: 552 pruebas Node correctas, una omisión existente, TypeScript y diff correctos. Los contratos comprueban acciones de botones, ausencia de promesas de archivos inexistentes, conservación del detalle de hallazgos y revisiones anteriores. Renderizado local con datos existentes conserva todas las observaciones. Sin cambios del grafo Python, sin nueva extracción ni llamadas de generación. La validación local no se presenta como comprobación nativa de Chrome ni como aceptación de calidad editorial.
