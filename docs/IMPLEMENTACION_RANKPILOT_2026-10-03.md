# RankPilot: implementación local y validación del 3 de octubre de 2026

Estado: cambios locales sobre `af1368558ed38309e630b647e08dac9423848e02`. **Sin despliegue y sin modificaciones a las submissions de Ángela.** Este informe actualiza el estado posterior al [plan maestro](PLAN_MAESTRO_RANKPILOT_2026-10-02.md); no convierte pruebas sintéticas en aceptación de negocio.

## Decisión arquitectónica

LangGraph y agentes inteligentes no son alternativas excluyentes. Se conserva LangGraph como orquestador de roles especializados con contratos verificables: registro de fuentes, estrategia, redacción y revisión adversarial. El registro, la selección por IDs, la confidencialidad y la autorización de entrega tienen controles deterministas. El modelo propone y critica; no puede saltarse esos controles.

El corredor realmente usado por Studio —ingesta, optimizaciones parciales, completion, Word— ahora comparte una decisión de entrega. Cambiar solamente el grafo antiguo no habría corregido ese corredor. Se añadió un grafo editorial acotado en `ai-engine/core/review_graph.py`, conectado a completion, con estrategia, carta y juez. La corrección de la carta se limita a un intento por fase; un defecto de hechos o del Word no se disfraza como resuelto reescribiendo la carta.

No se sostienen las promesas de 4–5 llamadas, 98% de éxito, reducción de coste/latencia o estabilidad definitiva del documento de Gemini. La implementación mantiene redacción por asunto y suma revisión del archivo: el número de llamadas depende del expediente. Los nuevos traces registran modelo, uso y tiempos; aún no hay una medición representativa de coste total en producción.

## Cambios implementados

- Ingesta A por DOCX y B por múltiples fuentes: aceptación de `sources` sin texto redundante, rechazo explícito de cero asuntos y errores de proveedor, señalización de fuentes fallidas y conservación del borrador ante resultados parciales. Se conserva incertidumbre de publicación y conflicto de importes.
- Persistencia: reemplazo de asuntos en transacción, control de revisión, guardados sin falsos mensajes de éxito, protección ante ediciones concurrentes y combinación de optimizaciones por ID, incluso si dos mandatos comparten cliente.
- Autoridad de fuentes: un texto previamente generado o un campo enviado por el navegador no sustituye los hechos guardados. B10 usa la fuente original o una corrección humana explícita. Se eliminaron numerosas reglas por nombre de cliente, biografías inventadas, conversiones y resultados automáticos.
- Selección y documento: una selección canónica por ID, reservas separadas, anonimización limitada a entidades del expediente y carta interna breve basada en hechos. El Word público no incorpora la etiqueta interna «Hero Matter».
- Entrega: revisión de borrador, generación de DOCX, extracción del texto de sus partes y revisión del archivo renderizado. Solo se sirve el archivo exacto aprobado, vinculado mediante hash a los datos de entrada y a sus bytes. Cualquier cambio exige revisión nueva.
- Studio: estado compartido con el backend, bloqueos y observaciones visibles, confirmación de permisos, conservación de avances, periodo de trabajo con procedencia humana y verificación de rankings. Se mantiene el diseño general y se corrigió el desbordamiento móvil.
- Criterio experto: 15 reglas versionadas en `editorial_rules.v1.json`, con referencias y hashes. Las conversaciones de referencia mezclan intervenciones de la dueña y del modelo; no se atribuye todo su contenido a Ángela ni se afirma aprobación suya del nuevo criterio.

## Verificación oficial de rankings

### Defectos encontrados

El código anterior podía identificar una firma por su primera palabra, escoger un país diferente si la jurisdicción era regional, conservar una banda declarada cuando no encontraba coincidencia y llamar «verificado» a contexto recuperado sin documentar su alcance. La URL de Laboral/México en Chambers apuntaba a un identificador distinto del publicado en su navegación actual. La caché no exigía la versión del parser ni evidencia de la edición.

### Contrato nuevo

Se separan declaración y observación: firma, directorio, práctica, país, edición solicitada, posición observada, URL oficial, fecha de consulta, hash del HTML y versión del parser. No se infiere una banda de firma a partir de un abogado. La identidad se compara de forma normalizada pero exacta; las variaciones sustantivas requieren resolver la identidad, no coincidencias por primera palabra.

Estados: coincidencia verificada, discrepancia verificada, posición observada sin declaración, edición ausente/distinta, alcance distinto, identidad ambigua, sin coincidencia, evidencia vencida y consulta no disponible. «Sin coincidencia» **no significa** «no rankeada». Una caída del scraper tampoco acredita ausencia.

El usuario puede comparar una edición concreta o, explícitamente, la tabla pública consultada en la fecha indicada. Este segundo alcance permite contrastar Legal 500 cuando la página no acredita una edición: **no se inventa el año ni se afirma una edición histórica**. Banda y Tier no se equiparan. La declaración no se sobrescribe con lo encontrado; las correcciones que el usuario guarda quedan registradas.

La verificación usa evidencia de hasta un día y descarta cachés de parsers antiguos. Las URLs de Chambers se actualizaron desde la navegación oficial de su guía de Latinoamérica; cada página sigue pasando validación de práctica y país. Eso amplía cobertura, pero no demuestra que todas las categorías estén accesibles ni cubre automáticamente todas las guías mundiales. Una combinación no soportada queda pendiente.

### Comprobación con fuentes reales

Registro reproducible: [ranking-live-qa.json](reviews/ranking-live-qa.json).

- Chambers, Laboral/México: el parser recuperó 24 firmas y 70 abogados, con edición 2027. No encontró una coincidencia exacta para DeForest en la tabla consultada. No se concluyó ausencia global de ranking.
- Legal 500, Laboral/México: 30 entradas, incluyendo DeForest en Tier 5. La página no acreditó una edición; la comparación histórica quedó pendiente. Comparando explícitamente la tabla actual, una declaración sintética «Tier 2» produjo discrepancia con Tier 5.
- Chambers, Tax/Venezuela: recuperó la tabla y comparó correctamente ARAQUEREYNA con Band 2 para la edición publicada.

Las declaraciones Band/Tier 2 de estas pruebas fueron **inputs sintéticos**, no declaraciones atribuidas a Ángela. Fuentes: [Chambers Laboral/México](https://chambers.com/legal-rankings/labour-employment-mexico-9:1596:144:1), [Legal 500 Laboral/México](https://www.legal500.com/c/mexico/labour-and-employment), [Chambers Tax/Venezuela](https://chambers.com/legal-rankings/tax-venezuela-9:49:229:1).

## Validación y límites de la evidencia

- Pruebas Python: 132 aprobadas, incluyendo identificación de firmas, ediciones, alcance, caché, fuentes y correcciones acotadas.
- Pruebas Node: 200 aprobadas. Incluyen contratos, renderizadores, rutas reales con DB/auth simuladas, transacciones fallidas, revisión concurrente, dos asuntos con el mismo cliente, cierre de aprobación y descarga de los mismos bytes aprobados.
- Ingesta: 8/8 pruebas locales de contratos y 4/4 casos con modelo real. Una matriz adicional de diez prácticas por A/B obtuvo 20/20 en extracción. Estas cifras no equivalen a 20 expedientes revisados integralmente.
- Matriz editorial adicional: diez prácticas con redacción real de B10/asunto y grafo editorial. La última corrida con entradas completas obtuvo 10/10 borradores aprobados y 10/10 DOCX generados. La revisión del Word terminó con 10/10 aprobados con observaciones cuando correspondía: seis conservaron su primera aprobación y cuatro se volvieron a revisar tras añadir la corrección acotada de cartas obsoletas. No fue un 100% al primer intento. Son expedientes sintéticos breves, de un mandato cada uno, no pruebas de carga de 30–40 asuntos.
- Se conservaron corridas anteriores que detectaron cambios de tiempo verbal, reinterpretación de «valor del asunto», confusión del juez entre fases, requisitos de consentimiento no presentes en la política y cartas con estado de proceso obsoleto. No se borraron para presentar únicamente resultados favorables.
- Chrome: componente real del Studio, servicios simulados; guardado fallido visible, guardado correcto y ancho móvil de 390/390 px, sin errores de ejecución. **No es un E2E autenticado contra producción.**
- TypeScript y build de Next: aprobados. `git diff --check` sin incidencias. No se ejecutó instalación con `postinstall` ni migración de base de datos.

Fuentes de resultados: [ingesta A/B](reviews/practice-ingestion-qa.json), [microredacción y grafo](reviews/practice-editorial-qa.json), [DOCX](reviews/practice-artifact-qa.json), [revisión posterior al render](reviews/practice-final-qa.json), [Studio](reviews/studio-browser-qa.json).

## Comunicación con el usuario y recuperación

La petición adicional de mejorar la comunicación produjo cambios funcionales, no solo nuevos textos:

- El Builder distingue documentos sin asuntos, fuentes parcialmente ilegibles, sesión expirada y conflictos de revisión. Indica qué corregir y qué versión se conserva; no muestra trazas del proveedor.
- Tras fallar la extracción, un reintento en la misma pantalla reutiliza el borrador creado. Las notas permanecen visibles y se aclara cuáles aún no están guardadas. Esto no equivale a recuperación tras cerrar el navegador.
- El progreso cuenta pasos procesados y redacciones realmente guardadas, identifica asuntos pendientes y elimina estimaciones ficticias de segundos. La revisión final informa que puede tardar minutos.
- Los errores del Studio permanecen visibles y accesibles, sin ventanas `alert()` ni mensajes de éxito cuando falló una operación.
- El indicador de preparación mide presencia de campos, no calidad ni probabilidad de ranking. Se retiró el supuesto mínimo obligatorio de diez asuntos y la equiparación de longitud de texto con resultado obtenido. Un asunto pendiente puede ser válido y un valor económico ausente no obliga a inventarlo.
- El asistente conserva la práctica seleccionada; una señal temática sugiere revisar, no cambia la práctica ni anuncia rechazo del directorio. Un guardado fallido mantiene la ventana y los cambios; el reintento respeta la revisión con la que se abrió.
- B10 solo se incorpora como corrección humana de hechos si el usuario modificó su fuente. Abrir y guardar el asistente no convierte automáticamente un texto generado en verdad de origen.
- Se eliminaron del Studio conversiones monetarias por nombres/importes conocidos, selección automática de casos por cliente y correos inventados para responsables. La selección canónica aprobada prevalece en pantalla.
- La posición inicial puede quedar sin declarar. Una banda vacía no se transforma automáticamente en «Unranked».

Pruebas Chrome adicionales: [Builder](reviews/builder-browser-qa.json) —rechazo de receta, notas preservadas y un solo borrador tras reintentar— y [asistente](reviews/wizard-browser-qa.json) —fallo visible, reintento, práctica conservada, revisión estable y fuente no promovida—. Servicios de persistencia simulados; ninguna prueba alteró producción.

## Lo que falta antes de considerar cerrado el producto

1. **Orquestación duradera.** Las optimizaciones guardadas se conservan y pueden reanudarse, pero la revisión final sigue siendo una petición HTTP con presupuesto temporal. No se implementaron todavía cola de trabajos, checkpoints persistentes, lease del worker ni recuperación automática tras caída del proceso. Es el siguiente bloque de arquitectura.
2. **Criterios por directorio y edición.** La aprobación editorial nueva está configurada para Chambers. La consulta de rankings de Legal 500 funciona con alcance explícito; eso no convierte su plantilla y sus políticas de entrega en validadas. Faltan matriz completa de requisitos y verificación del periodo oficial por práctica/edición.
3. **Corpus de aceptación de Ángela.** Convertir referencias revisadas en casos fuente–resultado esperado–defecto prohibido, con atribución clara. Validar tamaño real, múltiples asuntos, anexos y los tres expedientes históricos; inventariar 116 archivos no es revisarlos todos ni contar con aprobación editorial.
4. **Observabilidad y staging.** Persistir métricas de extremo a extremo, correlación de requests, costes, decisiones y versión de backend. Los logs internos de Render y el expediente histórico Tax no estuvieron disponibles en la consulta de producción previa. Probar sesión autenticada, red lenta, cierres de navegador y concurrencia real contra una base aislada.
5. **Despliegue coordinado y reversión.** Publicar primero las capacidades compatibles del motor, después Studio/completion, con feature flag, pruebas de humo y rollback. La versión desplegada actual no incorpora estos cambios locales. No presentar a Ángela estas pruebas como una certificación universal.

Conclusión: la base es considerablemente más verificable y ya evita varias clases de errores demostrados; aún no hay evidencia para declarar el producto robusto para cualquier expediente o prometer que no volverán a aparecer incidencias. El criterio de salida debe ser que cada afirmación y cada aprobación se puedan explicar, que los casos aceptados pasen y que los insuficientes se detengan de forma útil, sin perder trabajo.
