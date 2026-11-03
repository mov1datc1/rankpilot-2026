# Resultado de la prueba desde cero en la sesión de Ángela

## Resultado comprobado

Las nuevas pruebas de Ramos Castillo y DeForest terminaron en Optimized, con aprobación editorial independiente de sus parejas Submission y Audit exactas. Ambas conservan una advertencia no bloqueante sobre periodo de investigación no informado. Las acciones antes de presentar siguen en cada Audit; aprobación editorial no acredita elegibilidad temporal, presentación ante el directorio ni un resultado de ranking.

| Prueba | Entrada y selección | Resultado final |
| --- | --- | --- |
| Ramos Castillo | Original Chambers, Modalidad A, 33 asuntos extraídos; 11 seleccionados, 8 públicos y 3 confidenciales | Revisión 4, trabajo completed, pareja aprobada |
| DeForest | Original Leaders League, Modalidad B, 32 asuntos extraídos; 20 seleccionados, todos confidenciales | Revisión 7, trabajo completed, pareja aprobada |

Los archivos se cargaron y descargaron desde Chrome en la sesión de Ángela. Los cuatro Word descargados coinciden por SHA256 con los bytes aprobados guardados. Se inspeccionaron visualmente las 54 páginas: Ramos 18 + 3; DeForest 29 + 4. No se detectaron recortes ni caracteres fuera de página. Se conservaron las continuaciones de tablas y saltos de sección de la plantilla; no se reempaquetaron los finales después de su aprobación.

Las fuentes mantuvieron sus hashes durante preparación y reparaciones. No se hicieron correcciones de hechos ni de veredictos por SQL. La excepción de presupuesto se registró en el historial del trabajo y solo cambió su control de ejecución, sin editar documentos o fuentes.

## Código que produjo el resultado

- `5e8ed7b`: variantes ortográficas de la misma parte en el mismo asunto como tarea editorial de RankPilot, con evidencia literal y contexto; no como confirmación humana automática. No concede aprobación ni equipara subsidiarias, cargos o entidades distintas por similitud.
- `bf7ede5`: completar errores locales de una delta ya guardada sin volver a reparar afirmaciones anteriores que ya cambiaron; esquema de valor ligado a cada ruta y reanudación conservando consumo.
- `a4619a0`: atender todos los campos públicos expresamente señalados por un hallazgo de confidencialidad, conservando las correcciones ya aplicadas y acotando las fuentes.
- `54c7e0ce82866eefc7bf76aa12a6aa9a3de77c0f`: corregir una biografía pública sin tocar su narrativa confidencial aunque compartan texto literal; registrar ampliaciones expresas de consumo y limitar a una revisión final la autorización recibida.

Todos se publicaron en dev y main por fast-forward. [CI del código final](https://github.com/mov1datc1/rankpilot-2026/actions/runs/41725995569) correcto: TypeScript, 445 pruebas Node correctas y una omitida, 392 Python correctas. [Vercel producción](https://vercel.com/jhons-projects-2d167afe/rankpilot-2026/3qNBHVEJY1sQ8p8BMmcrSFc8YQCk) correcto. Motor y worker Render LIVE en `54c7e0c`; huella del motor `74273bff8b0a4eec764a1a2ceebdd88768c1bc3979b72c96176788fabf004606`.

## Fallos observados y autocorrección

Ramos necesitó reparaciones automáticas de selección, desarrollo y pareja Word antes de aprobar. DeForest rechazó combinaciones públicas identificables, un estado demasiado amplio y una falsa solicitud de confirmación de grafía. La prueba permitió corregir también un bucle real del reparador: volvía al hallazgo anterior después de guardar cambios parciales y rechazaba un campo devuelto sin cambios. El worker retomó automáticamente el mismo trabajo después de publicar la corrección.

DeForest alcanzó su presupuesto inicial. Jonathan autorizó expresamente hasta 250.000 tokens adicionales para las correcciones públicas restantes, las variantes del cliente en el Audit y UNA revisión final, sin extracción ni selección. Se conservaron 1.209.770 tokens anteriores. La ampliación consumió 219.008, dejó 30.992 sin consumir y terminó con aprobación en esa única revisión. Total del trabajo de reparación: 1.428.778; no es el total de toda la extracción y primera preparación del caso. No se compraron más revisiones después de aprobar.

## Límites y respuesta para Ángela

Los Audit conservan acciones de presentación relativas a periodo/actividad relevante, referencias y aclaraciones concretas de los originales. No deben comunicarse como nuevos errores de generación ni como una certificación de que todos los datos administrativos están completos. La grafía del cliente de DeForest ya no requiere que el usuario elija un nombre.

La recuperación durable de llamadas OpenAI largas mediante Responses ID sigue siendo una mejora de infraestructura separada que esta prueba no acredita haber integrado. Los resultados de estos dos casos no prueban autocorrección infalible para cualquier expediente. Se observaron salud, logs y memoria de Render, despliegue y aplicación Vercel; las etapas editoriales se ejecutan en el worker, no como solicitudes Vercel separadas. Una captura vacía de logs no prueba ausencia de errores.

Texto propuesto, sin envío realizado:

> Ángela, terminamos la prueba desde cero de DeForest y Ramos en tu sesión. Ambos expedientes tienen Submission y Audit aprobados por la revisión editorial, y comprobamos que las descargas son exactamente esos archivos. Corregimos las causas del bloqueo por variantes del mismo nombre, las combinaciones identificables en texto público y el bucle de reparación. Las fuentes permanecieron intactas. Los Audit conservan las acciones concretas antes de presentar, incluido el periodo de investigación y las aclaraciones de origen correspondientes. Te compartimos los cuatro Word finales y el registro de validación.

La evidencia privada, capturas, recibos y fuentes permanecen ignorados en `scratch/e2e-angela-2026-11-03`. Los cuatro entregables finales están en la carpeta local `Auditoria-RankPilot-2026-11-03/Prueba-desde-cero`. No publicar fuentes, borradores o Word confidenciales en Git.
