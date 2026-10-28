# 🔍 Auditoría Full Stack PRO — RankPilot v1 → v2

Auditoría exhaustiva comparando el proyecto original (Laravel + Vue/Inertia + Python) contra el nuevo proyecto (Next.js 16 + Prisma + Python) para identificar brechas funcionales, deuda técnica y sugerencias de mejora profesional.

---

## 1. Comparativa Arquitectónica

| Aspecto | Viejo (rAnkpIlot-main) | Nuevo (rankpilot-new-repo) | Veredicto |
|---|---|---|---|
| **Frontend** | Vue 3 + Inertia.js (SPA) | React 19 + Next.js 16 (App Router) | ✅ Upgrade PRO |
| **Backend Web** | Laravel (PHP) | Next.js Server Actions (TypeScript) | ✅ Simplificado |
| **Backend IA** | Python FastAPI + LangGraph | Mismo Python FastAPI + LangGraph | ✅ Sin cambios necesarios |
| **ORM** | Eloquent (Laravel) | Prisma v7 | ✅ Tipado fuerte |
| **Auth** | Laravel Breeze + Supabase | Supabase Auth directo | ⚠️ Falta middleware |
| **PDF Gen** | LaTeX → pdflatex (Python) + Spatie (PHP) | Solo placeholder (simulated) | 🔴 **GAP CRÍTICO** |
| **Estado Rankings** | 5 estados (En progreso → Aceptado/Rechazado) | 2 estados (Draft / AI Optimized) | ⚠️ Simplificado |
| **Validaciones** | Extremamente detalladas (50+ reglas) | Mínimas | ⚠️ GAP |

---

## 2. Funcionalidades del Viejo Proyecto NO Migradas

### 🔴 CRÍTICO — Deben implementarse

#### 2.1 Generación de PDF/DOCX Real
- **Viejo:** El `writer_node` de Python genera **LaTeX profesional** con portada institucional, se compila con `pdflatex` y se devuelve como archivo descargable. Además, Laravel tenía `ChambersPdfRenderer` y `RankingPdfGenerator` como fallbacks con Spatie.
- **Nuevo:** Los botones de descarga en `/reports` solo muestran un `alert()`. No hay generación real de documentos.
- **Sugerencia PRO:** Crear un endpoint `/generate-report` en el Python backend que reciba el `submission_id`, recupere todos los Matters optimizados, y genere el PDF/DOCX usando el `writer_node` ya existente. El frontend solo necesita hacer `window.open(url)`.

#### 2.2 Formulario de Chambers Completo (11 Tabs)
- **Viejo:** El `RankingController` tiene un formulario de **~50 campos** organizados en tabs: General Info, Department, Practice Area, Partners (con lista dinámica de abogados), Differentiator, Strengths, Feedback A, Feedback B, Clients, Cases.
- **Nuevo:** El Builder solo captura 3 campos (Directory, Region, Practice Area) y el Matter tiene 5 campos.
- **Sugerencia PRO:** Migrar el formulario completo de Chambers como un "Advanced Mode" dentro del Builder. Los datos se guardarían en un campo JSON tipo `datos` en la tabla `Submission` (igual que el viejo hacía con `Ranking.datos`).

#### 2.3 Upload y Parsing de Documentos
- **Viejo:** `DocumentParser` en Python soporta `.docx` y `.pdf` (usando PyMuPDF y python-docx). El `ingestion_node` extrae el texto completo y lo pasa al pipeline de IA.
- **Nuevo:** El upload en el Builder es cosmético — no se envía ningún archivo al backend.
- **Sugerencia PRO:** Implementar upload real con Supabase Storage + llamar al endpoint Python con `is_file: true` para que el grafo haga la extracción automática de Matters.

---

### ⚠️ IMPORTANTE — Mejorarían significativamente el producto

#### 2.4 Sistema de Estados del Ranking (Workflow)
- **Viejo:** `Ranking` tenía 5 estados: `IN_PROGRESS` → `IN_REVIEW` → `SENT` → `ACCEPTED` / `REFUSED`. Con timestamps de aceptación/rechazo.
- **Nuevo:** Solo hay `Draft` y `AI Optimized`.
- **Sugerencia PRO:** Agregar al modelo `Submission` los estados: `Draft` → `In Review` → `Submitted` → `Accepted`/`Rejected`. Agregar columnas `submittedAt`, `acceptedAt`, `rejectedAt` al schema de Prisma.

#### 2.5 "Improve Tab" — Mejora Inteligente por Sección
- **Viejo:** `improveTab()` en el `RankingController` enviaba los campos de una pestaña específica al asistente de OpenAI y reemplazaba los textos con versiones mejoradas sin perder el contexto de la conversación.
- **Nuevo:** Solo existe `optimizeMatterWithAI` que optimiza un Matter completo de golpe.
- **Sugerencia PRO:** Agregar un botón "Improve" por campo/sección en el Builder que envíe solo ese bloque al Python backend con instrucciones de mejora de redacción.

#### 2.6 Logs de IA (Trazabilidad)
- **Viejo:** El modelo `IALog` registraba cada prompt enviado y cada respuesta recibida de OpenAI, con timestamps y `user_id`.
- **Nuevo:** No hay registro de las interacciones con la IA.
- **Sugerencia PRO:** Crear una tabla `AILog` en Prisma con `userId`, `matterId`, `prompt`, `response`, `durationMs`, `createdAt`. Esto es esencial para debugging, auditoría y mejora de prompts.

#### 2.7 Catálogo de Áreas de Práctica
- **Viejo:** Modelo `AreaPractica` con catálogo dinámico que se auto-populaba conforme se creaban rankings.
- **Nuevo:** Los campos de Practice Area son strings libres.
- **Sugerencia PRO:** Crear un enum o tabla de catálogo para estandarizar los nombres de áreas de práctica.

---

### 💡 NICE TO HAVE — Refinamientos PRO

#### 2.8 Conversation ID / Thread Persistence
- **Viejo:** El `Ranking` almacenaba el `conversation_id` de OpenAI para mantener contexto entre sesiones.
- **Nuevo:** Se usa el `matterId` como `thread_id` temporal (correcto para uso básico), pero no hay persistencia real del hilo.
- **Sugerencia PRO:** Almacenar el `thread_id` retornado por Python en la tabla `Matter` para poder retomar conversaciones.

#### 2.9 Mark as Sent / Accepted / Rejected
- **Viejo:** Rutas dedicadas: `mark-sent`, `mark-accepted`, `mark-rejected` con timestamps.
- **Nuevo:** No existe.
- **Sugerencia PRO:** Agregar botones en el Dashboard para cambiar el estado del Submission y llevar un registro de qué proyectos fueron aceptados por el directorio.

#### 2.10 Positioning Intelligence (Assessment)
- **Viejo:** Módulo completo de "Positioning" con `PositioningAssessmentToolService` que evaluaba el posicionamiento competitivo de la firma.
- **Nuevo:** La pantalla `/submissions/context` tiene datos estáticos (0 matters, 0% confidence).
- **Sugerencia PRO:** Conectar la pantalla de Context al `analysis_node` del Python backend para mostrar datos reales del análisis de posicionamiento.

---

## 3. Problemas de Seguridad Detectados

| # | Problema | Severidad | Archivo | Sugerencia |
|---|---|---|---|---|
| 1 | **No hay middleware de autenticación** en las rutas protegidas. Cualquiera puede acceder a `/submissions`, `/reports`, `/dashboard-analytics` sin login. | 🔴 Alta | `src/middleware.ts` (NO EXISTE) | Crear middleware de Next.js que verifique la sesión de Supabase y redirija a `/login` si no hay sesión. |
| 2 | **`updateMatterOptimization` no valida ownership.** Cualquier usuario autenticado podría modificar matters de otros usuarios. | 🔴 Alta | `actions/matters.ts:71` | Agregar verificación de `userId` antes de permitir la actualización. |
| 3 | **`updateSubmissionStatus` no valida ownership.** | 🔴 Alta | `actions/submissions.ts:58` | Mismo fix: validar que el submission pertenezca al usuario. |
| 4 | **Service Role Key expuesta si se filtra `.env.local`.** | ⚠️ Media | `.env.local` | Agregar `.env.local` al `.gitignore` (ya está, pero verificar que no se subió al repo). |
| 5 | **No hay rate limiting en las llamadas a la IA.** Un usuario podría hacer spam de optimizaciones. | ⚠️ Media | `actions/matters.ts:84` | Implementar un cooldown de 30s por Matter o un contador diario. |

---

## 4. Problemas de Calidad de Código

| # | Problema | Archivo | Sugerencia |
|---|---|---|---|
| 1 | `createdAt` no existía en el modelo `User` pero se usaba en `orderBy`. | `admin/page.tsx` | ✅ Ya corregido en esta sesión. |
| 2 | Template literals con backslash `\`` causan fallos de Turbopack. | `admin.ts`, `AddUserModal.tsx` | ✅ Ya corregidos. |
| 3 | Propiedades CSS duplicadas (`color` x2). | `AdminSidebar.tsx` | ✅ Ya corregido. |
| 4 | Tipos de Prisma (`null` vs `undefined`) no coinciden con interfaces del frontend. | `matters/page.tsx` | ✅ Ya corregido. |
| 5 | El `Sidebar.tsx` accede a `localStorage` sin verificar `typeof window` (SSR crash potencial). | `Sidebar.tsx:35` | Agregar `typeof window !== 'undefined'` antes de acceder a localStorage. |
| 6 | No hay manejo de errores visual para el usuario cuando falla el fetch a la API de Python. | `matters/page.tsx` | Mostrar un toast/banner de error en lugar de solo `console.error`. |

---

## 5. Resumen Ejecutivo de Acciones

### ✅ Ya Corregido (Esta Sesión)
- [x] Errores de build de Vercel (template literals, tipos, duplicados)
- [x] Tablas de BD creadas con `prisma db push`
- [x] Reports rediseñado con branding consistente
- [x] Dashboard Analytics creado desde cero con KPIs
- [x] Todas las rutas del Sidebar funcionales

### 🔴 Próximas Prioridades (Sprint 2)
1. **Middleware de autenticación** → Proteger todas las rutas
2. **Generación real de PDF/DOCX** → Conectar Python `writer_node` con el frontend
3. **Upload real de documentos** → Supabase Storage + Python `ingestion_node`
4. **Formulario de Chambers completo** → Migrar las 11 tabs del viejo proyecto

### ⚠️ Deuda Técnica a Resolver
1. Validaciones de ownership en Server Actions
2. Logs de IA para trazabilidad
3. Estados avanzados del workflow (Sent, Accepted, Rejected)
4. Rate limiting en llamadas de IA

---

*Auditoría generada por Full Stack Expert — RankPilot v1 → v2 Migration Assessment*
