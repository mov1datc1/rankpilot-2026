# El Cielo: contraste histórico y bloqueo de extracción

Revisión de solo lectura del 3 de noviembre de 2026. No se ejecutaron nuevas llamadas a OpenAI, extracciones, generaciones ni modificaciones de los expedientes.

## Conclusión

El historial respalda a El Cielo como asunto central de Real Estate y candidato a Hero Matter. El bloqueo de la prueba autónoma no corresponde a una nueva evaluación estratégica: el extractor clasificó como contradictorios un estado procesal antiguo y su actualización explícita de 2024, antes de la selección.

## Evidencia histórica

- Mensaje original de Ángela conservado en `/Users/jonathanpalacios/.codex/attachments/3c23b4eb-7667-4a45-88f9-ed1ca0021a73/pasted-text.txt`, línea 14: «El Cielo debe ser uno de los asuntos centrales, e incluso el Hero Matter». En las líneas 146–150 vuelve a incluirlo entre los anchors. El archivo no acredita por sí solo la fecha de envío; el registro local del 8 de octubre atribuye ese feedback al 1 de octubre.
- `CHANGELOG.md`, v26.35, 8 de septiembre: declara resuelta precisamente la transición de `expected early 2023. UPDATE 2024` a `enforced in July 2024`.
- `CHANGELOG.md`, v29.4, 30 de septiembre: registra una corrección de falsa penalización fiscal y persistencia de El Cielo como Hero Matter. Son afirmaciones históricas de implementación, no pruebas de que el flujo actual las cumpla. La solución general no debe imponer nombres como héroes incondicionales.
- El informe compilado `angela-feedback-ramos-castillo-2026-10-27.txt`, líneas 111–124, atribuye a Ángela la instrucción de integrar descripción, updates, estado y resultados en una historia coherente. Se verificó este informe; no se localizó aquí su mensaje original equivalente.

## Comparación de expedientes

Ambos registros contienen el mismo SHA-256 del original: `6256a5f9c571ecb146f9220ecd9aee629abdb0acc2432e377d7597e545998cdc`.

| Registro | Resultado observado |
| --- | --- |
| `fa1c9bd2-420d-4773-a41d-5e748e85ce15` | Optimized, revisión 4; `hero_matter_id` corresponde a El Cielo. Su campo temporal conserva el estado antiguo y UPDATE 2024; no tiene incidencias de extracción. Este antecedente asistido no prueba autonomía. |
| `08a1716c-9603-4e64-a234-46a47732f98f` | Draft, revisión 2; sin Hero Matter ni trabajo editorial. El Cielo tiene `completionDate` vacío y una incidencia `conflicting` con esos dos pasajes como alternativas. |

Las capturas JSON privadas están en `scratch/e2e-angela-2026-11-03/` y `scratch/autonomia-2026-11-03/`, respectivamente.

La actualización informa la confirmación del amparo de 2018 y la resolución favorable del amparo de 2021, ejecutada en julio de 2024. Son dos procedimientos y una progresión temporal explícita; el estado anterior no demuestra una incompatibilidad con el posterior. Esta lectura tampoco acredita actividad posterior a 2024 ni sustituye la evaluación del periodo aplicable.

## Mecanismo del fallo

`ai-engine/utils/source_reconciliation.py` ya ordena al modelo no confundir fechas distintas con contradicciones. Sin embargo, `read_facts` comprueba literalidad y alternativas distintas, acepta la clasificación `conflicting`, vacía el valor y crea la incidencia. No valida semánticamente si los pasajes describen una actualización cronológica.

`src/lib/audit/input-review.ts:53` exige resolver expresamente esa incidencia; `src/lib/audit/preparation-input.ts:20` impide preparar documentos mientras siga pendiente. Por ello las mejoras posteriores de redacción cronológica no llegan a ejecutarse.

La capa de conciliación se incorporó en `5709f34` (11 de octubre). Esto identifica el origen de la capa, pero no demuestra que ese commit introdujera por sí solo la clasificación errónea observada: la extracción anterior del mismo original no la produjo.

## Implicación para la corrección

Debe corregirse y comprobarse la distinción general entre actualización temporal y contradicción real en la conciliación inicial. La aceptación debe cubrir también dos procedimientos distintos, hechos incompatibles del mismo periodo y conservación de la evidencia. No basta con reforzar la redacción final, fijar El Cielo como héroe o confirmar manualmente este expediente. Esta investigación no aplica esa corrección ni declara superada la prueba autónoma.
