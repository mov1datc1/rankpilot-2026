# Guía Paso a Paso: Configuración de Resend para Landing Page y Captación de Leads

Esta guía detalla el proceso exacto para configurar **Resend** (`https://resend.com`) y conectar el envío de correos transaccionales y notificaciones de prospectos (*leads*) en **Rankings Decoded** (`https://www.rankingsdecoded.com`).

---

## 1. ¿Cómo funciona el flujo de correos en Rankings Decoded?

Cuando un visitante completa el formulario de consulta en la Landing Page (`https://www.rankingsdecoded.com/#consultation`):

1. **Registro en Base de Datos**: El lead se guarda automáticamente en PostgreSQL (tabla `LeadInquiry`), visible en tiempo real en el panel de control: `https://www.rankingsdecoded.com/dashboard/admin/leads`.
2. **Notificación Interna (Equipo Rankings Decoded)**:
   - **Destinatarios**: `info@rankingsdecoded.com` (o los configurados en `CONTACT_NOTIFICATION_EMAILS`).
   - **Asunto**: `[Rankings Decoded] New Enquiry: {Nombre de la Firma} — {Nombre del Contacto}`
   - **Reply-To**: El email del prospecto (para responderle directamente con un clic).
3. **Acuse de Recibo al Prospecto (Confirmación Institucional)**:
   - **Destinatario**: El correo laboral ingresado por el prospecto.
   - **Remitente**: `Rankings Decoded <info@rankingsdecoded.com>`
   - **Firma**: **Ángela Castillo** (*Founder & Principal Strategist*).
   - **Asunto**: `Enquiry received: Rankings Decoded — {Nombre de la Firma}`

---

## 2. Paso 1: Crear y validar el Dominio en Resend

Para que los correos no caigan en SPAM y Resend permita enviar desde `@rankingsdecoded.com`, se debe validar el dominio con registros DNS:

1. Inicia sesión en [Resend](https://resend.com).
2. En el menú lateral izquierdo, haz clic en **Domains** y presiona **Add Domain**.
3. Ingresa tu dominio:
   - **Domain**: `rankingsdecoded.com`
   - **Region**: Selecciona `us-east-1` (Recomendada).
4. Resend te mostrará una tabla con **3 registros DNS esenciales**:
   - **DKIM (DomainKeys)**: Tipo `TXT` o `CNAME` (ejemplo: `resend._domainkey.rankingsdecoded.com`).
   - **SPF**: Tipo `MX` y `TXT` (para autorizar el servidor de envío de Resend).
   - **DMARC**: Tipo `TXT` (Nombre: `_dmarc.rankingsdecoded.com`, Valor: `v=DMARC1; p=none;`).
5. Dirígete al proveedor donde gestionas el DNS de `rankingsdecoded.com` (Cloudflare, GoDaddy, Namecheap, Vercel DNS o AWS Route53) y agrega los registros tal como te los indicó Resend.
6. Regresa a Resend y haz clic en **Verify DNS Records**. Una vez propagado (suele tardar entre 2 y 15 minutos), el estado cambiará a **Verified (Verificado)** en verde.

---

## 3. Paso 2: Generar la API Key en Resend

1. En el menú de Resend, dirígete a **API Keys** (`https://resend.com/api-keys`).
2. Haz clic en **Create API Key**.
3. Configuración de la llave:
   - **Name**: `Rankings Decoded - Production`
   - **Permission**: `Full Access` (o `Sending Access` con permiso para `rankingsdecoded.com`).
4. Haz clic en **Add** y **copia inmediatamente el token generado** (inicia con `re_...`). *Guárdalo en un lugar seguro porque no volverá a mostrarse completo.*

---

## 4. Paso 3: Configurar la API Key en Rankings Decoded

El sistema está diseñado con **doble respaldo**: puedes configurarlo directamente desde la interfaz web de administración (sin necesidad de hacer redeploy) o a través de las variables de entorno en Vercel.

### Opción A: Desde el Panel de Administración (Recomendada - Inmediata sin redeploy)

1. Inicia sesión como administrador en `https://www.rankingsdecoded.com`.
2. Dirígete a **Configuración de Sistema**:
   `https://www.rankingsdecoded.com/dashboard/admin/settings`
3. En la sección **Configuración de Resend**:
   - **RESEND_API_KEY**: Pega la API Key que copiaste (`re_xxxxxxxxxxxxxx...`).
   - **Email Remitente (From)**: Escribe exactamente:
     ```text
     Rankings Decoded <info@rankingsdecoded.com>
     ```
4. Haz clic en **Guardar Configuración**. ¡Listo! La base de datos persistirá los datos inmediatamente.

---

### Opción B: En Vercel (Variables de Entorno para Producción)

Para asegurar que los nuevos despliegues siempre tengan la configuración por defecto:

1. Entra a tu proyecto en [Vercel Dashboard](https://vercel.com).
2. Ve a **Settings** → **Environment Variables**.
3. Agrega las siguientes variables:

| Variable | Valor Recomendado | Descripción |
| :--- | :--- | :--- |
| `RESEND_API_KEY` | `re_xxxxxxxxxxxxxxxxxxxx` | Llave API privada obtenida de Resend. |
| `RESEND_FROM_EMAIL` | `Rankings Decoded <info@rankingsdecoded.com>` | Remitente oficial de los correos salientes. |
| `CONTACT_NOTIFICATION_EMAILS` | `info@rankingsdecoded.com,angela.castillo@rankingsdecoded.com` | Correos que recibirán la alerta cada vez que un lead llene el formulario (separados por coma). |

4. Si realizas cambios en Vercel, haz un **Redeploy** para que tomen efecto.

---

## 5. Paso 4: Probar la Conexión en 1 Clic

Rankings Decoded cuenta con una herramienta de prueba integrada:

1. Entra a: `https://www.rankingsdecoded.com/dashboard/admin/smtp`
2. En la tarjeta **"Validar Conexión con Resend"**:
   - Ingresa tu correo personal en el campo de prueba.
   - Presiona **Enviar Correo de Prueba**.
3. Si la API Key y el dominio están verificados, verás una confirmación en verde: *"Correo de prueba enviado exitosamente"*, y recibirás el email en tu bandeja de entrada en segundos.

---

## 6. Paso 5: Prueba de Fuego desde la Landing Page

1. Abre `https://www.rankingsdecoded.com` en una ventana de incógnito o baja hasta la sección `#consultation`.
2. Llena el formulario con datos de prueba:
   - **Full Name**: `Prueba Jonathan`
   - **Work Email**: `tu_correo@movidatci.com`
   - **Firm Name**: `Firma Legal Demo`
   - **Role**: `Managing Partner`
   - **Country**: `Mexico`
   - **Message**: `Prueba de recepción de leads y confirmación automática.`
3. Envía el formulario.
4. **Verificación**:
   - En pantalla: Mensaje de confirmación en verde.
   - En tu bandeja: Correo de confirmación firmado por Ángela Castillo.
   - En la bandeja de `info@rankingsdecoded.com`: Notificación con todos los detalles del lead.
   - En el panel admin (`/dashboard/admin/leads`): El nuevo prospecto aparecerá listado como `NEW`.

