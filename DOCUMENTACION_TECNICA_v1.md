# RankPilot - Documentación Técnica (v1.0)

Este documento describe la arquitectura, flujo de datos y componentes clave de **RankPilot**, la plataforma B2B SaaS diseñada para automatizar y optimizar la creación de _Submissions_ para directorios legales (Chambers, Legal 500, etc.) mediante Inteligencia Artificial.

---

## 1. Arquitectura del Sistema

RankPilot utiliza una arquitectura moderna de microservicios dividida en dos grandes bloques (Frontend/Orquestador Web y Backend de IA).

### 1.1 Tech Stack Principal
- **Frontend & Orquestador Web:** Next.js 16 (App Router) + React + Turbopack.
- **Estilos:** Vanilla CSS (Glassmorphism, Dark Mode, UI Premium) + Tailwind (opcional/soporte) + Lucide Icons.
- **Base de Datos & ORM:** PostgreSQL alojado en **Supabase**. Manejado estrictamente a través de **Prisma ORM (v7)**.
- **Autenticación:** Supabase Auth (Integrado en el backend y frontend para control de sesiones).
- **Backend de IA (Cerebro):** Servidor independiente en Python utilizando **FastAPI** y **LangChain** para procesar las llamadas a modelos de lenguaje (OpenAI).

### 1.2 Entornos y Despliegue
- **Web App (Next.js):** Desplegado en **Vercel** (Ramas `dev` y `main`).
- **Python API (IA):** Desplegado en **Render** (o similar). La URL se expone a Vercel mediante la variable de entorno `PYTHON_API_URL`.

---

## 2. Flujo de Trabajo Principal (SaaS Workflow)

El ciclo de vida de un proyecto dentro de RankPilot se divide en cuatro módulos principales:

### 2.1 Builder (Submissions)
- **Ruta:** `/submissions`
- **Descripción:** El usuario inicia un nuevo proyecto (Submission). Selecciona el directorio destino (ej. Legal 500), región y área de práctica. Sube su borrador o documento inicial.
- **Estado de Base de Datos:** Se crea un registro en la tabla `Submission`.

### 2.2 Context & Audit Room
- **Rutas:** `/submissions/context` y `/submissions/audit-room`
- **Descripción:** El sistema extrae los datos clave del documento (Matters, Lawyers, Referees). En el Audit Room, un "Co-piloto Estratégico" interroga al usuario para rellenar vacíos de información o fortalecer debilidades estructurales antes de redactar.

### 2.3 Matters Assistant (El Motor de IA)
- **Ruta:** `/submissions/matters`
- **Descripción:** El usuario revisa los _Matters_ (casos) extraídos. Al hacer clic en "Optimize", el frontend llama a un **Server Action** (`src/app/actions/matters.ts`), el cual se comunica vía POST con el endpoint `/process` del servidor Python en Render.
- **Integración Python:** 
  - El servidor Python orquesta LangChain, procesa el caso con IA y devuelve el texto optimizado.
  - Next.js recibe la respuesta, actualiza el estado del _Matter_ a `AI Optimized` y lo persiste en Prisma.

### 2.4 Reports (Entregables)
- **Ruta:** `/reports`
- **Descripción:** Un panel premium donde el usuario ve el progreso de todos sus proyectos. Si el 100% de los Matters han sido optimizados, el proyecto se marca como `READY`. 
- Permite descargar la compilación final en formatos nativos (DOCX, PDF) listos para ser enviados al directorio legal.

---

## 3. Módulo Administrativo y Roles (RBAC)

El sistema cuenta con Control de Acceso Basado en Roles (Role-Based Access Control) para garantizar la seguridad operativa y aislar la gestión de clientes SaaS.

### 3.1 Jerarquía de Roles
1. **SUPERADMIN:** Control total del sistema. Puede crear otros Admins y gestionar la configuración global del sistema (ej. credenciales, configuraciones SMTP).
2. **ADMIN:** Personal de operaciones. Puede gestionar usuarios del SaaS, ver métricas, pero no puede acceder a configuraciones críticas del sistema ni gestionar otros Admins.
3. **USER:** Cliente B2B del SaaS. Acceso exclusivo al Builder, Matters Assistant y Reports.

### 3.2 Panel Administrativo (`/dashboard/admin`)
- **Interfaz:** Tabla de datos con los usuarios registrados, mostrando su email, rol, estatus de la cuenta (`ACTIVE`/`INACTIVE`) e ID de suscripción de Stripe.
- **Creación de Usuarios:** A través de un modal seguro, un Superadmin/Admin puede aprovisionar nuevos clientes.
- **Mecanismo de Creación:** El Server Action (`src/app/actions/admin.ts`) utiliza `supabaseAdmin.auth.admin.createUser` para registrar la cuenta en Supabase Auth de forma invisible, y simultáneamente registra la entidad en Prisma.

---

## 4. Esquema de Base de Datos (Prisma)

Resumen de las entidades críticas en `schema.prisma`:

- **`User`**: Gestiona la identidad, `role` (enum), `stripeCustomerId` y `status`.
- **`Submission`**: Representa el "Proyecto" o documento maestro. Tiene relación de 1-a-muchos con `Matter`.
- **`Matter`**: Representa un caso de estudio individual. Almacena `rawNotes` (notas crudas del cliente) y `optimizedText` (resultado de la IA). Acepta valores nulos (`null`) durante las fases previas a la optimización.

---

## 5. Variables de Entorno Críticas

Para que el sistema funcione en producción (Vercel), deben configurarse las siguientes variables:

* `DATABASE_URL`: Cadena de conexión al pooler de PostgreSQL en Supabase (Puerto 6543, formato de sesión).
* `DIRECT_URL`: Conexión directa a PostgreSQL en Supabase (Puerto 5432, para migraciones de Prisma).
* `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Credenciales públicas para el cliente frontend.
* `SUPABASE_SERVICE_ROLE_KEY`: Llave maestra para creación de usuarios desde el Server Action (Ignora políticas RLS).
* `PYTHON_API_URL`: URL del backend de Inteligencia Artificial (ej. `https://rankpilot-backend.onrender.com/process`).

---
*Documento generado en la iteración v1.0 - RankPilot 2026.*
