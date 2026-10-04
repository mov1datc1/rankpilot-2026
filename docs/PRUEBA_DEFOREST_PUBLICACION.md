# Prueba de aceptación DeForest

Esta publicación habilita una prueba de aceptación; no certifica todos los expedientes ni completa la hoja de ruta.

## Comprobación de despliegue

Confirmar que Vercel sirve el commit de main y que Render expone `/review-package`, `/verify-rendered-package` y `/verify-ranking` en OpenAPI antes de iniciar la corrida. El frontend necesita esas capacidades del motor.

La instalación genera Prisma Client, sin ejecutar `db push --accept-data-loss`. Este cambio no introduce migraciones.

## Corrida

1. Crear un submission nuevo para DeForest, Labour & Employment, México y Chambers. Conservar el expediente anterior para comparar.
2. Usar los documentos fuente originales: opción A para el borrador o B para múltiples documentos. No cargar una salida previamente optimizada como sustituto de las fuentes.
3. Revisar asuntos extraídos, duplicados, importes/monedas, fechas, permisos de publicación y fuentes. Resolver insuficiencias con información real. Guardar, salir y volver a abrir para comprobar persistencia.
4. Verificar el ranking declarado con el directorio, país, práctica y edición correctos. “No encontrado” no significa automáticamente “Unranked”. Una discrepancia o consulta no disponible debe explicarse y no aprobar una banda sin evidencia.
5. Confirmar el periodo de investigación, optimizar y ejecutar la revisión final. Si hay bloqueo, registrar el mensaje exacto antes de corregirlo.
6. Descargar el Word y la carta disponibles; comprobar coherencia con Studio, confidencialidad, selección de asuntos y ausencia de hechos inventados.

## Evidencia para revisar juntos

Compartir URL o ID del submission, hora de inicio con zona horaria, opción A/B, nombres de archivos utilizados, mensajes de bloqueo y archivos descargados. No compartir contraseñas ni tokens.

La revisión editorial actual está calibrada para Chambers; la consulta de rankings Legal 500 no equivale a validar su entrega editorial. La revisión final sigue siendo síncrona: la recuperación duradera de trabajos queda pendiente.
