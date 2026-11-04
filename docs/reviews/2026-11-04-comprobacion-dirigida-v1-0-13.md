# Comprobación dirigida de sector y desenlace — v1.0.13

## Autorización y alcance

Jonathan autorizó expresamente una comprobación dirigida en OpenAI de los dos bloqueos, con fuentes privadas y un máximo conjunto de 40.000 tokens. Sin nueva extracción, reinicios ni cambios a los expedientes. Código de referencia `e6d863bc41f5078cfa4acbfd0f21806ae542cb14`; huella local `0273edfd562a386649a478c9925ce77579e80ebeab6aa14921f42076cda613ac`.

Se usaron el cliente/configuración de juez de RankPilot, las reglas BASE, el RAG de la práctica y los contratos de diagnóstico de producción, con una tarea explícitamente acotada al problema y su fuente original. Se revisaron extractos generados aislados, no la pareja Word íntegra ni la selección global. El límite de salida de cada llamada se redujo a 4.096 tokens para esta comprobación local; no cambió la configuración desplegada.

## Resultados observados

| Comprobación | Resultado del revisor | Entrada | Salida | Total |
| --- | --- | ---: | ---: | ---: |
| Sector de DeForest | `not_comparable`; sin hallazgo: industria registrada y característica laboral no expresan el mismo atributo | 13.506 | 214 | 13.720 |
| Desenlace de Ramos | Sin defecto en el extracto: el revisor consideró que el estado posterior explícito respalda el resultado narrado y leyó la referencia judicial general en su contexto | 13.078 | 885 | 13.963 |
| Total | Dos llamadas de generación completas | 26.584 | 1.099 | 27.683 |

La lectura judicial es una interpretación del modelo, no una confirmación externa de la sentencia ni una nueva respuesta del cliente. No se modificó ninguna fuente ni se guardó esa interpretación como resolución confirmada.

Ninguno de los dos diagnósticos solicitó reparar el extracto. Por ello no se compró una reparación ni otra revisión sobre la misma respuesta; no se agotó el saldo autorizado por el mero hecho de estar disponible.

## Control de consumo e integridad

Antes de cada generación, el endpoint de conteo de entrada de OpenAI contó la petición completa con su esquema. El presupuesto reservó entrada, máximo de salida y margen antes de permitir la generación. La entrada contada coincidió con la entrada reportada por cada respuesta. Cero reintentos del SDK y cero respuestas con consumo desconocido. Dos solicitudes de conteo y dos de generación; la cifra anterior es el uso reportado de las generaciones, no una factura completa del proveedor.

El límite de salida incluye los tokens no visibles, incluido razonamiento; se usa el consumo reportado, no el tamaño del texto visible. Referencia: [OpenAI Docs: conteo de tokens](https://developers.openai.com/api/docs/guides/token-counting).

Cero extracciones, reinicios, reparaciones o escrituras a los expedientes. Los snapshots originales siguen idénticos. Evidencia privada, fuera de Git: `scratch/closure-v13-focused/paid-ledger.json`, resultados de ambos revisores, `summary.json`, `final-receipt.json` y el ejecutor aislado. No publicar su contenido legal ni credenciales.

## Qué demuestra y qué queda pendiente

La comprobación demuestra que el modelo configurado, con las instrucciones actuales y el contexto acotado, puede distinguir estos dos casos sin reproducir los bloqueos anteriores. No demuestra que todas las observaciones de Ángela estén cerradas ni que se hayan reparado documentos: no se pidió ninguna reparación.

Falta una ejecución autónoma completa con versión fija y revisión de los documentos finales. Los expedientes detenidos conservan su rechazo histórico y sus límites; esta prueba no los reactiva ni autoriza otra ejecución completa. Una comprobación futura deberá informar su alcance y consumo antes de iniciarse, sin atribuirse al saldo de este permiso dirigido.
