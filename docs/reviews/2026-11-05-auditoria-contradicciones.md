# Auditoría transversal de pausas y contradicciones

Estado: v1.0.18 publicada y prueba nueva terminada sin aprobación de la entrega. No se modificaron fuentes privadas, expedientes detenidos, presupuestos ni documentos históricos durante esta auditoría.

Se revisaron las reglas compartidas, contratos de selección y reparación, preflight del builder, dependencias del checkpoint, persistencia del trabajo, consumo conocido/desconocido, recuperación y presentación de hallazgos. La revisión no prueba que todos los posibles documentos produzcan una entrega aprobada.

## Hallazgos corregidos y comprobación

| Contradicción | Cambio local | Comprobación |
| --- | --- | --- |
| Una regla exigía resolver el permiso ausente mientras la política permite destino confidencial. | Regla canónica explícita: E no confirma consentimiento, no permite publicación pública y no exige una respuesta para conservar el destino seguro. | Casos ficticios con permiso pendiente, confidencial, destino público y política ajena. |
| Revisor y reparador no recibían la política que debían aplicar. | Ambos reciben delivery_policy y reglas de aplicación. | Inspección de los payloads en regresiones sin modelos. |
| Un error de aplicación debía probarse con una cita de narrativa del cliente. | Evidencia tipada: fuente original o regla de aplicación. Una regla nunca prueba desenlace, sector, cuantía ni mérito. | Rechazo de metadatos serializados, regla inventada, combinación de tipos y citas de otra decisión. |
| Un diagnóstico recibido pero no fundamentado se confundía con una respuesta perdida. | Una sola nueva lectura del diagnóstico dentro del máximo existente de tres revisiones semánticas; no regenera la selección. Consumo desconocido impide esa lectura. | Simulación de diagnóstico inválido, revisión fundada, reparación acotada y revisión independiente; cuarta revisión nunca invoca modelo. |
| Una continuación podía perder indicadores del diagnóstico y reutilizar prosa dependiente de una selección rechazada. | Conserva contadores, diagnóstico, historial y trazas; elimina desarrollo, carta y veredictos dependientes. | Continuación tras aplazamiento previo a la llamada y contratos del checkpoint. |
| Una excepción inesperada del SDK podía no conservar la incertidumbre de consumo. | Conserva llamadas previas y registra una llamada de consumo desconocido al fallar la invocación. | Excepciones de conexión, tiempo y SDK; no se presentan como cero tokens. |
| Un clic de reintento podía sustituir el ledger de una etapa fallida. | Devuelve el mismo trabajo para las mismas fuentes; conserva recuperación técnica específica ya acotada y cuarentena por consumo desconocido. | Repetición manual en desarrollo, grounding, presupuesto y conexión sin nuevas escrituras. |
| Una pausa anterior podía bloquear las respuestas nuevas del usuario. | El servidor comunica si el trabajo corresponde a las fuentes actuales; la interfaz no aplica la pausa histórica a fuentes distintas. | Fuentes iguales y editadas, sin alterar el trabajo anterior. |
| El builder ofrecía destinos que la revisión final no soporta. | Destino editorial limitado a Chambers y Legal 500 antes de consumir. Opción B conserva originales históricos de otros directorios. | Preflight TypeScript y Python con destinos soportados/no soportados. |
| B10 faltante se detectaba tarde y la interfaz prometía generarlo mientras lo bloqueaba. | Requiere la descripción de origen antes de preparar; indica dónde aportarla. Una redacción generada no sustituye la fuente. | Fuente original, confirmación guardada, texto generado sin fuente. |
| Algunos registros sin narrativa o con notes/description se trataban de forma distinta entre capas. | Campos originales consistentes; un campo con espacios no oculta otra fuente válida; identifica el registro vacío antes de pagar. | Campos originales, registro parcialmente vacío y selección con cita propia. |
| Consulta de ranking sin coincidencia se describía como discrepancia oficial. | Distingue verified_mismatch de no encontrado, no disponible o vencido; mantiene bloqueo de afirmaciones sin verificar. | Veredictos positivos simulados no saltan el requisito de verificación. |
| Una pausa mostraba un marcador ajeno de borrador listo y ninguna acción concreta. | Muestra checks de selección con tipo de evidencia y diagnóstico pendiente. Explica que esperar/clicar no reanuda; permite copiar referencia para solicitar revisión al administrador. | Contratos de estado/hallazgos y compilación de interfaz. No se inventa un plazo ni un canal de soporte. |

## Límites que se conservan

- Máximo tres revisiones semánticas de selección. La nueva lectura del diagnóstico ocupa una de esas plazas; no amplía presupuesto ni reinicia contadores.
- La reparación final automática permite como máximo dos ciclos de reparación después de la comprobación inicial. El supervisor evalúa el historial anterior a la comprobación actual: puede haber tres comprobaciones del artefacto en total, algunas deterministas sin llamada al modelo. La prueba nueva observó ese límite; no se amplió.
- Las discrepancias materiales de identidad, moneda, importe, rol o desenlace siguen requiriendo evidencia o una respuesta real cuando no existe una formulación fiel. Un descriptor prescindible puede omitirse bajo las reglas existentes; eso no autoriza inventar un resultado.
- La conexión del navegador no gobierna el trabajo durable. Una pérdida entre motor y proveedor puede dejar consumo desconocido; se conserva y se detiene. No existe recuperación durable por Responses ID ni un tope de facturación impuesto al proveedor.
- El presupuesto de tokens se comprueba al iniciar una etapa; una etapa con varias llamadas puede sobrepasarlo antes de registrar su consumo. No debe anunciarse como un límite duro de facturación.
- El checkpoint editorial caduca a las 24 horas y puede regenerar entregables; el ledger del trabajo conserva el gasto y su límite. La caducidad de evidencia de ranking también es de un día. Separar renovación de evidencia de regeneración editorial requiere otro diseño y pruebas: no se elimina la caducidad ni se presume que sea un bucle observado en la aceptación fallida.
- No hay canal de soporte técnico integrado en el producto. La referencia copiable permite identificar el intento; no abre un ticket ni promete atención automática.

## Validación y condición de cierre

454 pruebas Python correctas. 473 contratos Node correctos y uno omitido. TypeScript y compilación de producción correctos. Pruebas locales con respuestas simuladas, sin nuevas llamadas a OpenAI.

La aceptación autónoma completa sigue pendiente. El usuario autorizó publicar y probar desde cero; la ejecución y su fallo se documentan abajo. La prueba mantuvo la versión fija y no tuvo correcciones manuales durante su ejecución. No reutilizar este intento histórico ni ampliar sus límites.

## Publicación y prueba nueva de v1.0.18

Código `8fff1b9f71cc30710182c085b1a1568a735c53dd`, publicado en dev y main mediante avance atómico. Vercel Production Ready `MjYbqTTvT6KFhzZnVFKGoJhmDuww`; motor `dep-dbmbr3rncjis73958q6g` y worker `dep-dbmbr3jncjis73958pvg` LIVE en el mismo commit, con despliegues automáticos. Health online y huella `3621743322bcb8fbca38556a64ea41ce891c0c51e3fc86d9c092d2db12962e6b`. El estado GitHub consultado confirma Vercel success; no se afirma una ejecución separada de CI.

Prueba nueva por opción B en la sesión habitual: original intacto, una extracción, revisión normal conservando permiso ausente sin confirmar en E y una preparación editorial. Versión fija, sin correcciones manuales, ampliaciones ni reinicios. Recuperó 32 asuntos; la selección superó tres revisiones semánticas y conservó 19 principales. El aplazamiento previo a una llamada continuó bajo el mismo trabajo. El desarrollo reparó automáticamente voz auditora y el proceso generó el Audit y una pareja Word borrador.

La entrega terminó `needs_review / repair_progress_limit`, con un hallazgo crítico de contenido generado. Una explicación editorial de por qué se omitía un sector afirmaba una incompatibilidad entre clasificación sectorial y característica de la fuerza laboral. El revisor señaló que eran atributos distintos; la frase cuestionada permaneció después de la corrección y el control de afirmaciones sin reparar la volvió a rechazar antes de otra revisión de pago. No hubo artefacto aprobado. Los límites detuvieron el intento; no se levantaron para obtener un pase.

Consumo conocido: 56.010 de extracción y 799.822 editoriales, total 855.832 tokens. Un trabajo y 12 entradas de ledger; las entradas sin llamada nueva no se contabilizan como consumo de modelo. Se conservaron fuentes, snapshots, respuestas, documentos borrador, trazas y recibo final en evidencia privada fuera de Git. El observador de solo lectura terminó al detectar la pausa. No se inició otra ejecución.

La selección autónoma avanzó respecto del intento anterior, pero no se ha cerrado la aceptación completa. La siguiente corrección debe impedir que una decisión interna sobre omitir atributos se convierta en una afirmación del Submission y comprobar que el reparador elimina la cita exacta rechazada en el campo correcto. No corresponde solicitar al usuario que cambie sus fuentes, ni quitar el control final, ni aumentar las rondas para ocultar este fallo.
