'use server';

import prisma from '@/lib/prisma';
import { createClient } from '@supabase/supabase-js';

// Usamos el cliente de supabase-js puro para tener acceso a admin_auth si la llave existe
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function createUser(data: { email: string; password?: string; role: string }) {
  try {
    const { email, password, role } = data;

    // 1. Verificar si el usuario ya existe en Prisma
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return { success: false, error: 'El usuario ya existe en el sistema.' };
    }

    // 2. Intentar crear en Supabase Auth
    let authUserId = null;
    
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      // Flujo Ideal: Tenemos Service Role, usamos la API de Admin
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: password || 'RankPilot2026!', // Contraseña por defecto si no envían
        email_confirm: true,
        user_metadata: { role }
      });

      if (authError) throw new Error(\`Error en Supabase Auth: \${authError.message}\`);
      authUserId = authData.user.id;
    } else {
      // Flujo Alternativo: No hay Service Role. Solo guardamos en Prisma.
      // Advertimos que el usuario no podrá iniciar sesión hasta que se registre manualmente en Auth.
      console.warn('ADVERTENCIA: SUPABASE_SERVICE_ROLE_KEY no está configurada. El usuario se creó en la BD pero no en Auth.');
    }

    // 3. Crear en Prisma
    const newUser = await prisma.user.create({
      data: {
        id: authUserId || undefined, // Prisma generará un UUID si authUserId es nulo
        email,
        role: role as any,
        status: 'ACTIVE'
      }
    });

    return { success: true, data: newUser };
  } catch (error: any) {
    console.error('Error creating user:', error);
    return { success: false, error: error.message || 'Error desconocido al crear usuario.' };
  }
}
