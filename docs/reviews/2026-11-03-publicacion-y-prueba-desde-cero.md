# Publicación y prueba desde cero — 2026-11-03

## Commit publicado

`6aea55befe904ffe886385e9bc2ac2a066fda296` se integró por fast-forward de `dev` a `main` y ambas ramas se publicaron. Sigue a `f90c922ea88ebe8ff9eea73a6470039bcaba7098`, que contiene las salvaguardas editoriales principales.

- Descarga del borrador: entrega la pareja guardada exacta si la vinculación con los datos actuales y ambos SHA256 siguen siendo válidos. Evita regenerar otros textos desde las filas originales de Matter.
- La vinculación del borrador no concede aprobación editorial. Los finales sin aprobación siguen bloqueados.
- B10 y montos aparecen como guardados/registrados; se retiraron etiquetas de verificación sin respaldo. La revisión del Word corregido corresponde a RankPilot.
- Se comprobó la invalidación por edición y la detección de bytes corruptos. TypeScript sin errores; 443 pruebas Node: 442 correctas, una omitida, cero fallos.
- [CI del SHA](https://github.com/mov1datc1/rankpilot-2026/actions/runs/41712166141): correcto. [Compilación de producción Vercel](https://vercel.com/jhons-projects-2d167afe/rankpilot-2026/7QwkxZjSpPCD2BEvpCbQbjtmkwQA): correcta.
- Cuatro descargas autenticadas desde producción coincidieron byte por byte con los borradores corregidos guardados. La comprobación del Submission final de DeForest y Audit final de Ramos devolvió `ARTIFACT_REVIEW_REQUIRED`.
- Motor Render: `f90c922`, live; el seguimiento no cambió `ai-engine`. Worker: `6aea55b`, live.

## Límite editorial

Los dos expedientes actuales siguen en Draft, revisión 4, sin aprobación de los Word modificados después de los rechazos. Las fuentes y los históricos aprobados permanecen intactos. No confundir la publicación del código con aprobación de documentos ni con recuperación durable de llamadas largas, que sigue pendiente de integración en producción.

Los recibos privados y documentos están fuera de Git en la carpeta local `Auditoria-RankPilot-2026-11-03`. No publicar fuentes, prompts, credenciales ni datos de clientes en este registro.

## Prueba nueva autorizada por Jonathan

Jonathan solicitó tomar el control y probar desde cero como Ángela en su sesión, monitoreando Render, Vercel y cada etapa. Esta nueva instrucción autoriza ejecutar el flujo normal con las fuentes originales de DeForest y Ramos, incluida la extracción y generación normal que requiere la aplicación. Es una prueba nueva; no reutilizar las correcciones manuales para presentarlas como éxito del proceso automático.

Secuencia: confirmar despliegue y sesión, abrir Builder, cargar el original, registrar campos presentes sin inventar permisos ni hechos, iniciar una vez, observar extracción y revisión de datos, seguir selección, desarrollo, Audit, reparación y revisión final; descargar únicamente cuando la aplicación lo permita. Contrastar las etapas visibles con trabajos y logs. No hacer reparaciones por SQL ni cambiar el veredicto durante esta prueba. Registrar fallos y consumo visible, evitar reinicios que dupliquen solicitudes y no presentar resultados incompletos como cierre.

Los resultados y capturas de esta ejecución se registrarán por separado. Este documento acredita la publicación y el protocolo; no acredita que la nueva prueba haya pasado.
