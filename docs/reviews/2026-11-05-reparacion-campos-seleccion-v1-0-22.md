# Reparación de campos generados en selección — v1.0.22

Una prueba autónoma de v1.0.21 se detuvo antes de redactar: la justificación de un asunto redondeó un importe, y el control determinista rechazó ese número. La llamada terminó con consumo conocido; no se observó un fallo de conexión. No produjo un nuevo Submission ni Audit aprobados, por lo que todavía no permite comparar la mejora editorial con la entrega anterior.

El grafo ahora localiza los defectos numéricos o de moneda de una justificación y los deriva a una reparación del campo, antes de la revisión semántica independiente. La respuesta solo puede devolver el ID y la justificación; conserva fuentes, selección, orden, Hero, citas y demás decisiones. El mismo control vuelve a verificar la corrección. No se relaja la fidelidad numérica ni se aprueba automáticamente un redondeo.

Las reparaciones comparten un máximo de dos con la recuperación semántica y conservan el corte ante un fallo repetido en el mismo asunto, revisión no disponible o diagnóstico inválido. Los fallos estructurales o de citas mantienen su rechazo. No se aumenta el presupuesto ni se reinicia el intento fallido. El hash de selección cambia para impedir reutilizar una validación del contrato anterior.

Validación: 486 pruebas Python aprobadas, incluidas seis de reparación localizada, conservación de decisiones, revisión independiente y corte de repetición. La aceptación autónoma de esta versión sigue pendiente. No se publican fuentes, importes privados ni identificadores de expedientes.
