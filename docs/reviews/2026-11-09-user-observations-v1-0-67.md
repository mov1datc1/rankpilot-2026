# Observaciones comprensibles y acciones de consulta — v1.0.67

La pantalla de documentos disponibles mostraba mensajes dirigidos al reparador: nombres de campos internos, instrucciones editoriales y términos como denominación canónica. El ajuste anterior de títulos no convertía esos mensajes en instrucciones comprensibles.

Se añade una capa de presentación que explica qué se encontró, qué implica y qué puede hacer el usuario. Periodo, variantes de nombres, confidencialidad y verificación de ranking tienen indicaciones específicas; las diferencias de escritura solo se describen como del mismo asunto cuando el hallazgo lo afirma. Los demás tipos tienen explicaciones por categoría y apartado; un tipo desconocido no se imprime como encabezado técnico. El mensaje original y sus citas quedan íntegros en un detalle desplegable.

Los botones abren datos, abogados, ranking o periodo sin generación. Se conecta el periodo a un formulario real y al guardado existente, con validación de fechas; antes el enlace volvía al panel de observaciones. Guardar no reescribe los Word anteriores ni inicia llamadas al modelo.

Validación local: 558 pruebas Node correctas y una omisión existente, TypeScript. Pruebas de navegación, fechas ausentes/invertidas, nombres arbitrarios, conservación del mensaje y fallback. Lectura de tres expedientes existentes: sus observaciones se conservan y los seis Word permanecen idénticos. Los términos internos comprobados ya no aparecen en el cuerpo principal. Sin llamadas OpenAI, nuevas generaciones ni cambios del grafo. Verificación nativa de Chrome pendiente por fallo del control; no equivale a una prueba autónoma desde Builder ni a mejora del contenido de los Word.
