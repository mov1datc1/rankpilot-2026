# Auditoría transversal de pausas y contradicciones

Estado: candidato de publicación v1.0.18 posterior a la última aceptación fallida; despliegue y prueba autónoma pendientes. No validado con una nueva ejecución de OpenAI. No se modificaron fuentes privadas, expedientes detenidos, presupuestos ni documentos históricos durante esta auditoría.

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
- La reparación final automática permite como máximo dos revisiones de la pareja Word en su historial de progreso: revisión inicial y una revisión después de reparación. Algunas notas históricas decían «dos rondas de reparación»; esa descripción no refleja el límite actual. No se aumenta para resolver una discrepancia documental.
- Las discrepancias materiales de identidad, moneda, importe, rol o desenlace siguen requiriendo evidencia o una respuesta real cuando no existe una formulación fiel. Un descriptor prescindible puede omitirse bajo las reglas existentes; eso no autoriza inventar un resultado.
- La conexión del navegador no gobierna el trabajo durable. Una pérdida entre motor y proveedor puede dejar consumo desconocido; se conserva y se detiene. No existe recuperación durable por Responses ID ni un tope de facturación impuesto al proveedor.
- El presupuesto de tokens se comprueba al iniciar una etapa; una etapa con varias llamadas puede sobrepasarlo antes de registrar su consumo. No debe anunciarse como un límite duro de facturación.
- El checkpoint editorial caduca a las 24 horas y puede regenerar entregables; el ledger del trabajo conserva el gasto y su límite. La caducidad de evidencia de ranking también es de un día. Separar renovación de evidencia de regeneración editorial requiere otro diseño y pruebas: no se elimina la caducidad ni se presume que sea un bucle observado en la aceptación fallida.
- No hay canal de soporte técnico integrado en el producto. La referencia copiable permite identificar el intento; no abre un ticket ni promete atención automática.

## Validación y condición de cierre

454 pruebas Python correctas. 473 contratos Node correctos y uno omitido. TypeScript y compilación de producción correctos. Pruebas locales con respuestas simuladas, sin nuevas llamadas a OpenAI.

La aceptación autónoma sigue pendiente. Antes de repetir extracción completa, corresponde comprobar con el modelo configurado que el diagnóstico tipado, la contención de un descriptor opcional y la reparación limitada funcionan juntos. El usuario autorizó posteriormente publicar e iniciar una prueba nueva desde cero. No reutilizar intentos históricos ni ampliar sus límites. La entrega completa deberá superar después una prueba fija sin cambios de código ni correcciones manuales durante su ejecución.
