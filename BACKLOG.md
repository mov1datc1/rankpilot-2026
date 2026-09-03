# RankPilot — Backlog de Producto y Roadmap (Fases 2+)

Este documento registra oficialmente las funcionalidades avanzadas, módulos estratégicos y evoluciones de arquitectura planificadas para las siguientes fases del desarrollo de RankPilot.

---

## 📌 Módulo 1: Base de Conocimientos Curada por Administrador (Admin Knowledge Base & RAG Curation)
**Prioridad:** Alta (Fase 2)  
**Alcance:** Exclusivo para Usuarios `ADMIN` y `SUPERADMIN`

### 💡 Descripción del Requerimiento
Permitir que cuando el Builder o el motor de IA genere una submission o auditoría de calidad sobresaliente (Gold Standard), un **Administrador/Owner** pueda revisar el resultado y hacer clic en el botón **"Guardar en Base de Conocimiento"**.

### 🛠️ Especificaciones Técnicas y Funcionales

1. **Control de Acceso (RBAC Security Guard):**
   - El botón y las acciones de curaduría solo se renderizan y ejecutan para usuarios con rol `role === 'ADMIN'` o `role === 'SUPERADMIN'`.
   - Protección a nivel de Server Action / API Route en Next.js.

2. **Flujo de Ingesta:**
   - **Trigger:** Botón `[⭐ Guardar en Base de Conocimientos]` en la pantalla de resultados del Builder o Vista de Submissions.
   - **Extracción de Activos:** El sistema extrae automáticamente:
     - Argumento C2 de posicionamiento (Mini-argumento de 4 pasos).
     - Transformación B10 de identidad departamental.
     - Rewrites ejemplares de Matters (Mecánica de trabajo, framing de rol, entregables).
   - **Indexación y Almacenamiento:**
     - Guarda el extracto curado en `ai-engine/rag_knowledge/editorial_memory/` o la tabla vectorial en Supabase PostgreSQL (`rag_editorial_memory`).
     - Asigna etiquetas de metadatos: `firm_id`, `practice_area`, `jurisdiction`, `quality_score`, `target_directory` (`Chambers` / `Legal 500`).

3. **Impacto en el Pipeline de IA:**
   - En ejecuciones futuras para esa misma firma o práctica, el `rag_router.py` cargará prioritariamente estos ejemplos aprobados por el Admin como **Gold Standard Context**, garantizando una mejora continua sostenida por la intervención humana experta.

---

## 📌 Módulo 2: Soporte Multi-Directorio Ampliado ("Paste Raw Text" & "Start from Scratch")
**Prioridad:** En Producción (Fase 1.5) / Refinamiento (Fase 2)

### 💡 Estado Actual y Funcionalidades
- **Chambers & Partners Template Mapping:** 100% mapeado en `submission-builder.ts` (Secciones A, B, C1, C2, D0-D9, E0-E9).
- **Legal 500 Template Mapping:** 100% mapeado en `buildLegal500Doc()` de `submission-builder.ts` (Title Page, Department Overview, Key Individuals, Leading Individuals, Next Generation, Rising Stars, Work Highlights).
- **Modos de Entrada:**
  - `Upload draft (.docx)`: Clona y reemplaza dentro de las celdas/`w:sdt` nativas del archivo del cliente.
  - `Paste Raw Text`: Analiza el texto plano pegado por el usuario, extrae entidades y genera la plantilla oficial oficial elegida (`Chambers` o `Legal 500`).
  - `Start from Scratch`: Genera una postulación completa de alta calidad partiendo de las variables del Setup Wizard y el conocimiento RAG de la práctica.

### 🔮 Evolución en Fase 2
- Mapeo de plantillas para **IFLR1000** (Banking/Finance/M&A) y **Leaders League** (IP/Litigation/Tax).
- Conversión bidireccional automática entre formatos de directorios (ej. Convertir una submission de Chambers en formato Legal 500 en un solo clic).

---

## 📌 Módulo 3: Automatización de Entrevistas y Coaching de Referees
**Prioridad:** Fase 2.5

- **Pre-Interview Brief Generator:** Genera un documento en PDF/DOCX de 1 página para los socios antes de su entrevista telefónica con el investigador de Chambers.
- **Referee Tracker & Status Sync:** Seguimiento de respuestas y confirmación de recepción de correos de investigación por parte de los clientes referenciados.

---

## 📌 Módulo 4: Analytics de Ranking e Impacto Histórico
**Prioridad:** Fase 3.0

- Correlación automática entre las submissions enviadas en años anteriores y el resultado final publicado en las guías de Chambers & Legal 500.
- Dashboard de predicción de banda basado en la densidad de evidencia de los matters y la fuerza del argumento C2.
