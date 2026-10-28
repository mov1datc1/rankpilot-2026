# 🔧 Guía: Configurar Stripe Webhook para RankPilot

## ¿Qué hace el Webhook?

Cuando un usuario completa el pago en Stripe, el webhook notifica automáticamente a RankPilot para:

1. **`checkout.session.completed`** → Crear la cuenta del usuario en Supabase + Prisma y enviarle el email de bienvenida vía Resend
2. **`invoice.payment_failed`** → Enviar email de fallo de pago (dunning) al usuario
3. **`customer.subscription.deleted`** → Desactivar la cuenta del usuario en el sistema

---

## Pasos para Configurar

### Paso 1: Ir al Dashboard de Stripe

1. Abre [https://dashboard.stripe.com](https://dashboard.stripe.com)
2. Asegúrate de estar en **modo Test** (toggle arriba a la derecha debe decir "Test mode")

---

### Paso 2: Crear el Endpoint del Webhook

1. En el menú lateral, ve a **Developers** → **Webhooks**
2. Haz clic en **"+ Add endpoint"**
3. En el campo **Endpoint URL**, pega:

```
https://rankpilot-2026.vercel.app/api/webhooks/stripe
```

4. En **"Select events to listen to"**, haz clic en **"+ Select events"** y selecciona estos 3 eventos:

| Evento | Propósito |
|--------|-----------|
| `checkout.session.completed` | Usuario completó el pago → crear cuenta |
| `invoice.payment_failed` | Falló un cobro → enviar email de dunning |
| `customer.subscription.deleted` | Canceló suscripción → desactivar cuenta |

5. Haz clic en **"Add endpoint"**

---

### Paso 3: Copiar el Signing Secret

1. Una vez creado el endpoint, haz clic en él para abrirlo
2. En la sección superior verás **"Signing secret"**
3. Haz clic en **"Reveal"** para ver el secret
4. Cópialo — tiene el formato: `whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

---

### Paso 4: Agregar el Secret a Vercel

1. Ve a [https://vercel.com](https://vercel.com) → tu proyecto **rankpilot-2026**
2. Ve a **Settings** → **Environment Variables**
3. Agrega una nueva variable:

| Key | Value |
|-----|-------|
| `STRIPE_WEBHOOK_SECRET` | `whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` (el que copiaste) |

4. Selecciona los environments: **Production**, **Preview**, **Development**
5. Haz clic en **Save**
6. **Re-deploy** el proyecto desde Vercel (Deployments → ··· → Redeploy)

---

### Paso 5: Agregar el Secret a tu `.env.local` (desarrollo local)

También pásame el secret y lo agrego al `.env.local` para desarrollo local. O puedes hacerlo manualmente editando el archivo:

```bash
# En .env.local, reemplaza la línea:
STRIPE_WEBHOOK_SECRET=""
# Por:
STRIPE_WEBHOOK_SECRET="whsec_tu_secret_aqui"
```

---

### Paso 6: Probar el Webhook

1. En el dashboard de Stripe, dentro del endpoint que creaste
2. Haz clic en la pestaña **"Testing"**
3. Selecciona el evento `checkout.session.completed`
4. Haz clic en **"Send test webhook"**
5. Deberías ver una respuesta **200 OK** ✅

> ⚠️ **Nota:** Para que el webhook funcione en producción, el proyecto debe estar desplegado en Vercel con las variables de entorno configuradas.

---

## Variables de Entorno Completas para Stripe

Estas son **todas** las variables de Stripe que deben estar en Vercel:

| Variable | Valor | Estado |
|----------|-------|--------|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_51TSEkB...` | ✅ Configurado |
| `STRIPE_SECRET_KEY` | `sk_test_51TSEkB...` | ✅ Configurado |
| `STRIPE_PRICE_ID` | `price_1TtvonJCRsF6IxChLrw6tEpl` | ✅ Configurado |
| `STRIPE_WEBHOOK_SECRET` | `whsec_xxxxx` | ⏳ **Pendiente — este paso** |

---

## Checklist Final

- [ ] Webhook creado en Stripe Dashboard
- [ ] 3 eventos seleccionados (checkout.completed, payment_failed, subscription.deleted)
- [ ] Signing secret copiado
- [ ] Variable `STRIPE_WEBHOOK_SECRET` agregada en Vercel
- [ ] Re-deploy ejecutado en Vercel
- [ ] Test webhook enviado con respuesta 200

---

## Flujo Completo (después de configurar)

```
Landing Page → Clic "Suscribirse" → Stripe Checkout → Usuario Paga
                                                            ↓
                                              Stripe envía webhook
                                                            ↓
                                    /api/webhooks/stripe recibe evento
                                                            ↓
                              Crea usuario en Supabase Auth + Prisma DB
                                                            ↓
                                   Envía email de bienvenida vía Resend
                                                            ↓
                                  Usuario recibe credenciales por correo ✅
```
