import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import prisma from '@/lib/prisma';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Supabase Admin for auto-creating users
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  let event: Stripe.Event;

  try {
    if (process.env.STRIPE_WEBHOOK_SECRET && signature) {
      event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } else {
      // If no webhook secret, parse the event directly (development mode)
      event = JSON.parse(body) as Stripe.Event;
    }
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Webhook Error' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const email = session.customer_email;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (!email) break;

        // Check if user exists
        let dbUser = await prisma.user.findUnique({ where: { email } });

        if (!dbUser) {
          // Create user in Supabase Auth
          let authUserId = null;
          if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
            const tempPassword = `RP${Math.random().toString(36).slice(2, 10)}!`;
            const { data: authData } = await supabaseAdmin.auth.admin.createUser({
              email,
              password: tempPassword,
              email_confirm: true,
              user_metadata: { role: 'USER', source: 'stripe' },
            });
            authUserId = authData?.user?.id;
          }

          // Create in Prisma
          dbUser = await prisma.user.create({
            data: {
              id: authUserId || undefined,
              email,
              role: 'USER',
              stripeCustomerId: customerId,
              subscriptionId: subscriptionId,
              status: 'ACTIVE',
            },
          });
        } else {
          // Update existing user with Stripe data
          dbUser = await prisma.user.update({
            where: { id: dbUser.id },
            data: {
              stripeCustomerId: customerId,
              subscriptionId: subscriptionId,
              status: 'ACTIVE',
            },
          });
        }

        // Send welcome email via Resend
        try {
          const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
          const apiKey = config?.resendApiKey || process.env.RESEND_API_KEY;
          if (apiKey) {
            const { Resend } = await import('resend');
            const resend = new Resend(apiKey);

            // Try to get custom template
            const template = await prisma.emailTemplate.findUnique({ where: { type: 'WELCOME' } });
            const dashboardUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://rankpilot-2026.vercel.app';
            
            let emailSubject = template?.subject || '¡Bienvenido a RankPilot!';
            let emailHtml = template?.htmlBody || `<h1>Bienvenido a RankPilot</h1><p>Tu suscripción ha sido activada.</p><p><a href="${dashboardUrl}/login">Iniciar Sesión</a></p>`;

            // Replace variables
            emailHtml = emailHtml.replace(/\{\{userName\}\}/g, dbUser.name || email.split('@')[0]);
            emailHtml = emailHtml.replace(/\{\{dashboardUrl\}\}/g, dashboardUrl);

            await resend.emails.send({
              from: config?.resendFromEmail || 'RankPilot <noreply@rankpilot.io>',
              to: email,
              subject: emailSubject,
              html: emailHtml,
            });
          }
        } catch (emailErr) {
          console.warn('Welcome email not sent:', emailErr);
        }

        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerEmail = invoice.customer_email;

        if (customerEmail) {
          // Send dunning email
          try {
            const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
            const apiKey = config?.resendApiKey || process.env.RESEND_API_KEY;
            if (apiKey) {
              const { Resend } = await import('resend');
              const resend = new Resend(apiKey);
              const template = await prisma.emailTemplate.findUnique({ where: { type: 'DUNNING' } });

              const dashboardUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://rankpilot-2026.vercel.app';
              let emailSubject = template?.subject || 'Problema con tu pago — RankPilot';
              let emailHtml = template?.htmlBody || `<h1>Problema con tu pago</h1><p>No pudimos procesar tu último cargo.</p>`;

              emailHtml = emailHtml.replace(/\{\{userName\}\}/g, customerEmail.split('@')[0]);
              emailHtml = emailHtml.replace(/\{\{dashboardUrl\}\}/g, dashboardUrl);

              await resend.emails.send({
                from: config?.resendFromEmail || 'RankPilot <noreply@rankpilot.io>',
                to: customerEmail,
                subject: emailSubject,
                html: emailHtml,
              });
            }
          } catch (emailErr) {
            console.warn('Dunning email not sent:', emailErr);
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Find user by stripeCustomerId and deactivate
        const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: { status: 'INACTIVE' },
          });
        }
        break;
      }
    }
  } catch (err: any) {
    console.error('Webhook handler error:', err);
    return NextResponse.json({ error: 'Webhook handler error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
