# Guía de Onboarding — Nuevo Miembro del Equipo

> Cómo agregar un colaborador a tus proyectos (GitHub, Vercel, Render, Antigravity IDE)  
> Última actualización: Agosto 2026

---

## Resumen Rápido

| Plataforma | Acción | Costo Extra | Tiempo |
|---|---|---|---|
| **GitHub** | Invitar como Collaborator al repo | Gratis | 2 min |
| **Antigravity IDE** | Instalar extensión + clonar repo | Gratis | 10 min |
| **Vercel** | Invitar al Team (Hobby: limitado) | Gratis (viewer) / $20/mo (dev) | 5 min |
| **Render** | Invitar al Team | Gratis (viewer) / varía (deploy) | 5 min |
| **Supabase** | Invitar a la organización | Gratis | 3 min |

---

## 1. GitHub — Acceso al Código

### Opción A: Collaborator en Repo Individual (Recomendado para 1-2 personas)

```
GitHub.com → Tu Repo (ej: mov1datc1/portal-rdf) 
→ Settings → Collaborators → Add people
→ Buscar por username o email → Invite
```

**Permisos disponibles:**

| Rol | Puede hacer | Usar cuando |
|---|---|---|
| **Read** | Ver código, clonar, crear issues | Solo quieres que revise |
| **Triage** | + Manejar issues y PRs | Project manager |
| **Write** | + Push directo, crear branches | **Usa este para devs** |
| **Maintain** | + Manage settings (no delete) | Lead dev |
| **Admin** | Todo incluido borrar repo | Solo tú |

**Mejor práctica**: Dale **Write** access. El dev trabaja en branches y abre PRs. Tú apruebas y mergeas a main.

### Opción B: Organización de GitHub (Recomendado para 3+ personas)

Si planeas trabajar con más gente, crea una organización:

```
GitHub.com → + (esquina superior) → New organization
→ Nombre: "movida-tci" o "tu-empresa"
→ Plan Free (unlimited repos, unlimited collaborators)
→ Transferir repos existentes a la org
```

**Ventajas de la org:**
- Teams (Frontend Team, Backend Team)
- Permisos granulares por team
- Billing centralizado
- Mejor para clientes (se ve más profesional)

### Branch Protection (IMPORTANTE)

Configura protección para que nadie haga push directo a main:

```
Repo → Settings → Branches → Add rule
Branch name pattern: main
- Require a pull request before merging
- Require approvals: 1
- Require status checks to pass (si tienes CI)
```

---

## 2. Antigravity IDE — Setup para el Nuevo Dev

El colaborador necesita:

### Paso 1: Instalar Antigravity IDE

El dev instala la extensión en VS Code / Cursor. Buscar "Antigravity" en el marketplace de extensiones.

### Paso 2: Autenticarse con su propia cuenta Google

Antigravity IDE → Sign In → Google Account del dev.

**IMPORTANTE: Cada dev usa SU PROPIA cuenta de Google para Antigravity.** No compartas tu cuenta. El agente funciona con el repo local — no necesita tu cuenta.

### Paso 3: Clonar el repo y trabajar

```bash
git clone https://github.com/mov1datc1/portal-rdf.git
cd portal-rdf
npm install
# Ya puede usar Antigravity con el proyecto
```

### Compartir Skills y Configuración

Si tienes skills personalizados en `.agents/` dentro del proyecto, el dev los recibe automáticamente al clonar. Para skills globales, inclúyelos en `.agents/skills/` dentro del repo.

---

## 3. Vercel — Acceso al Deploy

### Tu Plan Actual: Hobby

En Hobby puedes invitar **viewers** gratis pero no developers con deploy access.

### Cómo invitar:

```
vercel.com → Team Settings → Members → Invite
→ Email del dev → Rol: Viewer o Developer
```

| Rol | Puede hacer | Plan requerido |
|---|---|---|
| **Viewer** | Ver deploys, logs | Hobby (gratis) |
| **Developer** | Deploy, env vars, domains | Pro ($20/mo por miembro) |
| **Billing** | Manage billing | Pro |
| **Owner** | Todo | — |

**NO compartas tu cuenta de Vercel.** Si el dev necesita hacer deploys, la mejor opción con Hobby es:
1. El dev hace push a GitHub
2. Vercel auto-deploys desde el branch
3. El dev ve el preview deploy en el PR de GitHub

Así no necesita acceso Developer a Vercel.

### Mejor Práctica con Hobby Plan

```
Dev push a branch "feature/x"
  → Abre PR en GitHub
    → Vercel genera Preview URL automático
      → Dev prueba en preview URL
        → Tú apruebas PR
          → Merge a main = deploy a producción
```

El dev **nunca necesita login a Vercel** — Vercel genera preview URLs automáticos en cada PR.

---

## 4. Render — Acceso al Backend

### Cómo invitar:

```
render.com → Team Settings → Members → Invite Member
→ Email → Rol: Member o Viewer
```

| Rol | Puede hacer |
|---|---|
| **Viewer** | Ver servicios, logs |
| **Member** | Deploy, env vars, configurar servicios |
| **Admin** | Billing, delete services |
| **Owner** | Todo |

Dale **Viewer** para empezar. Si necesita cambiar env vars o hacer manual deploys, súbelo a **Member**.

### Alternativa: No dar acceso a Render

Igual que con Vercel — si Render auto-deploys desde GitHub:
1. Dev push a dev branch
2. Render auto-redeploys
3. Dev no necesita login a Render

---

## 5. Supabase — Acceso a la Base de Datos

### Cómo invitar:

```
supabase.com → Organization Settings → Members → Invite
→ Email → Rol
```

| Rol | Puede hacer |
|---|---|
| **Read only** | Ver tablas, ejecutar queries |
| **Developer** | + Crear migrations, editar RLS |
| **Admin** | + Manage org, billing |
| **Owner** | Todo |

**NUNCA compartas el service_role key.** Cada dev debe usar el anon key para desarrollo local. El service_role bypasses RLS y es solo para el servidor.

---

## 6. Variables de Entorno — Qué Compartir

### Seguro compartir (desarrollo local)

| Variable | Razón |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Es público por diseño |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Es público por diseño |
| `NEXT_PUBLIC_SITE_URL` | URL pública |

### Compartir con precaución

| Variable | Cómo |
|---|---|
| `DATABASE_URL` | Crear un usuario DB separado para el dev |
| `PYTHON_API_URL` | Puede apuntar al Render compartido |

### NUNCA compartir

| Variable | Por qué |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Bypass total de RLS |
| `OPENAI_API_KEY` | Tu billing |
| `STRIPE_SECRET_KEY` | Acceso a pagos |
| Passwords de producción | Obvio |

### Mejor Práctica: .env.example

Crea un archivo `.env.example` en el repo (sin valores reales):

```bash
# .env.example — Copiar como .env.local y llenar valores
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
DATABASE_URL=postgresql://user:password@host:5432/db
PYTHON_API_URL=http://localhost:8000
```

---

## 7. Ejemplo Concreto: Portal del Alumno (portal-rdf)

### Checklist para el nuevo dev:

**Pre-requisitos:**
- Cuenta de GitHub
- Node.js 18+ instalado
- VS Code o Cursor con Antigravity IDE

**Paso 1: GitHub (Jonathan hace esto)**
- Invitar como Collaborator (Write) a mov1datc1/portal-rdf

**Paso 2: El dev hace esto**
- Aceptar invitación de GitHub (llega por email)
- `git clone https://github.com/mov1datc1/portal-rdf.git`
- `cd portal-rdf && npm install`
- Copiar `.env.example` a `.env.local` → Jonathan envía los valores por DM seguro
- `npm run dev` → verificar que corre en localhost:3000

**Paso 3: Workflow diario**
- Crear branch: `git checkout -b feature/mi-feature`
- Trabajar + commit + push
- Abrir PR → Vercel genera preview URL automático
- Jonathan revisa y aprueba PR
- Merge a main → auto-deploy a producción

**Accesos opcionales (Jonathan decide):**
- Supabase: Invitar como Developer (read/write tablas)
- Vercel: Invitar como Viewer (ver logs/deploys)
- Render: Solo si hay backend separado

---

## 8. Seguridad — Reglas de Oro

1. **Cada persona usa SU cuenta** — nunca compartas login/password
2. **API keys van en variables de entorno** — nunca en código
3. **Branch protection en main** — nadie hace push directo
4. **Revisa PRs antes de merge** — 4 ojos ven más que 2
5. **Rota keys si alguien sale del equipo** — cambia API keys en Vercel/Render
6. **`.env` en `.gitignore`** — nunca subas secrets a GitHub

---

## Costos Mensuales por Agregar 1 Dev

| Servicio | Plan Actual | Costo por dev extra |
|---|---|---|
| GitHub | Free | $0 |
| Antigravity IDE | Free tier | $0 |
| Vercel | Hobby | $0 (viewer) / $20 (Pro dev) |
| Render | Free/Starter | $0 (viewer) |
| Supabase | Free | $0 (org member) |
| **Total mínimo** | | **$0/mo** |

Con el workflow de GitHub → auto-deploy, un dev puede trabajar productivamente con **$0 de costo adicional**. Solo necesita acceso a GitHub y las env vars de desarrollo local.
