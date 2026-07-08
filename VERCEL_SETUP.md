# Guía de Despliegue en Vercel para RankPilot 2026

Sigue estos pasos exactos para configurar y desplegar la aplicación en Vercel sin errores.

## 1. Conexión del Repositorio a Vercel

1. Ve a tu panel de [Vercel](https://vercel.com/dashboard).
2. Haz clic en **Add New...** > **Project**.
3. Importa el repositorio `mov1datc1/rankpilot-2026`.
4. En **Framework Preset**, Vercel debería detectar automáticamente **Next.js**. Déjalo así.
5. En **Root Directory**, déjalo en la raíz `./` (a menos que hayas movido el código a otra carpeta).

## 2. Variables de Entorno (Copy & Paste)

Antes de hacer clic en "Deploy", despliega la sección de **Environment Variables** y pega exactamente las siguientes llaves y valores. *(Nota: Vercel permite pegar todo el bloque si copias el texto de abajo tal cual y lo pegas en el primer campo de "Key")*.

```env
NEXT_PUBLIC_SUPABASE_URL=https://smeshjwepztrfnhncnxl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_CVbQbNXuYNEh3p0o45bxQw_iGU0t7ra
DATABASE_URL=postgresql://postgres.smeshjwepztrfnhncnxl:bs@LMPAK3@sqyg$@aws-0-ca-central-1.pooler.supabase.com:5432/postgres
DIRECT_URL=postgresql://postgres:bs@LMPAK3@sqyg$@db.smeshjwepztrfnhncnxl.supabase.co:5432/postgres
PYTHON_API_URL=https://rankpilot-ai-engine.onrender.com
```

> **Importante**: La variable `PYTHON_API_URL` asume que vas a desplegar la carpeta `ai-engine` (el código de Python) en un servicio como Render o Railway. Si aún no lo has desplegado, puedes dejar la URL de prueba o actualizarla más adelante en Vercel.

## 3. Comandos de Compilación (Build Settings)

En la sección **Build & Development Settings**, no necesitas cambiar nada si estás usando Next.js estándar. Los valores por defecto de Vercel son correctos:

- **Build Command**: `npm run build` o `next build` (Dejar en blanco / default)
- **Output Directory**: `.next` (Dejar en blanco / default)
- **Install Command**: `npm install` (Dejar en blanco / default)

## 4. Despliegue del Motor de IA (Python)

Vercel está optimizado para Next.js (Node.js). Para el motor de IA (`ai-engine/main.py`), que usa **FastAPI** y requiere compilar LaTeX (`pdflatex`), te recomiendo desplegar esa carpeta en **Render.com**.

### Pasos para Render:
1. Crea un nuevo **Web Service** en Render conectándolo a tu repositorio de GitHub.
2. En la configuración de **Root Directory**, escribe `ai-engine`.
3. **Environment**: Selecciona `Python 3`.
4. **Build Command**: `pip install -r requirements.txt && apt-get update && apt-get install -y texlive-latex-base` *(Esto es necesario para que el generador de PDF funcione en la nube).*
5. **Start Command**: `uvicorn main:api --host 0.0.0.0 --port 10000`

Una vez que Render te dé la URL de producción (ej. `https://rankpilot-ai-engine.onrender.com`), vuelve a Vercel, entra a **Settings > Environment Variables** y actualiza el valor de `PYTHON_API_URL`.
