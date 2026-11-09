## 2026-11-08 — v1.0.56: participación y alcance de recuperación coherentes

Las listas de integrantes con encabezados de formulario podían interpretarse como contribuciones individuales, exigiendo resultados que las fuentes no atribuían. Se normaliza el encabezado tanto en la cita como en el campo original y se exige identidad exacta; una narrativa sustantiva o un rol de liderazgo sigue requiriendo cobertura propia.

La recuperación de un perfil podía congelar su categoría al encontrar errores simultáneos de cita original y vínculo con el BIO. Ahora comparte la misma elegibilidad del primer intento: solo limita la reparación a texto y referencias cuando los demás datos son válidos. El diagnóstico identifica el campo y la cita exactos que fallan; no relaja la literalidad ni modifica originales. Se conservan aceptación transaccional, campos autorizados, rondas y consumo acumulado.

Validación: 724 Python, 509 Node correctas/una omitida y TypeScript correcto. Regresiones reproducidas antes de corregir; replay de una respuesta existente verifica los destinos de recuperación y elimina exigencias falsas de logro individual. Comprobación dirigida de dos perfiles corrigió las citas con 62.177 tokens conocidos, sin editar el expediente original ni aprobar documentos. La publicación y aceptación autónoma requieren verificación posterior; no se declara resuelta la calidad final por tests o replay.

