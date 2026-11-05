# Selection diagnostics and terminal findings — v1.0.17

A fixed-version production acceptance attempt reached extraction and then stopped in selection. Three actual independent reviews and two bounded corrections ran; the completed-review counter was accurate. The final selection remained rejected. No Submission/Audit pair was approved, and no manual document repair or live code change rescued the attempt.

The observed failure exposed three gaps: capacity bookkeeping entered a legal rationale; a conditional evidence request conflicted with deliverables already described by the decision; and the UI displayed a generic draft-ready marker instead of the current selection findings. A source quotation alone did not identify the allegedly false generated claim.

The correction shares decision-level reasoning across selector, repairer and reviewer. It separates application constraints from source facts, discourages capacity prose and checks the complete decision before alleging missing evidence. Rejected diagnostics must bind both original-source evidence and an exact quotation in the same decision; invalid diagnostics preserve consumption and stop without approval or an additional paid correction. Every matter still receives independent review, and genuine contradictions remain blocking.

The UI now exposes the saved selection checks for the current stopped selection. A selection rejection has an explicit pause reason. Repeated generation, even with an explicit retry or a newer build, returns the same rejected attempt when the source hash is unchanged. It cannot replenish its repair allowance.

Validation: 442 Python tests passed; 465 Node contract tests passed and one was skipped; TypeScript and production build passed. Added regressions cover absent/translated/foreign decision quotes, stopping before another generation on an invalid diagnosis, real terminal findings, and preservation of a rejected attempt on repeated start.

These checks verify local contracts. They do not establish that the revised model instructions produce a complete approved pair autonomously. No additional provider calls, historical verdict edits, source changes or budget extensions were made after the failed acceptance attempt. Detailed evidence remains private and outside Git. Publication/deployment verification is recorded separately after it occurs.

## Publicación y prueba fija — 2026-11-05

Código `dadd3a2653fddc09cf5ddf04897a92a3dbc31553` publicado en dev/main por avance rápido atómico. Vercel producción Ready y alias de la aplicación comprobados. Motor y worker de Render LIVE en ese mismo commit; health del motor devuelve la huella `2b84f92127ddc50b4344cf0520eb4a04e1c176b9e2af727c49442d9a2c2a5807`, igual a local. No se detectaron despliegues automáticos del nuevo commit; se iniciaron una vez desde los paneles y se verificaron hasta su estado final. No se modificó la configuración automática.

La nueva prueba por opción B ejecutó una carga/extracción y una preparación en la sesión habitual, con versión fija, original intacto, límites normales y sin intervención técnica durante la ejecución. Se detuvo en selección: el revisor citó metadatos de política de publicación de la aplicación como si fueran evidencia original del cliente. El binder no aceptó esa cita y la revisión quedó sin resultado utilizable; las dos respuestas y su consumo conocido se conservaron. No hubo reparación pagada, nueva extracción, ampliación ni reinicio tras el bloqueo. El intento permanece detenido.

No se redactó ni aprobó una pareja Word. La ruta AI_REVIEW_UNAVAILABLE aún presenta un marcador genérico de borrador en la interfaz; la mejora de hallazgos de SELECTION_REJECTED no cubre esta ruta. Queda pendiente separar expresamente evidencia original y autoridad de reglas de aplicación en el contrato del diagnóstico y comprobar esa conducta antes de otro recorrido completo. No convertir el diagnóstico inválido en aprobación ni resolver discrepancias materiales por sustitución de texto.

La revisión automática impidió transmitir el changelog histórico y metadatos privados de referencias. Se excluyó el changelog de la publicación y la configuración pública utiliza identificadores anónimos; el registro de referencias se conserva privadamente. El commit final parte del último main público, sin incorporar el commit local previo con esos metadatos. La evidencia del caso, consumo e identificadores permanecen fuera de Git. Este resultado no acredita cierre autónomo.
