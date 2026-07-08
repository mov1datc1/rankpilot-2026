require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
const ws = require('ws');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { realtime: { transport: ws } }
);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  const email = 'jonathan@movidatci.com';
  console.log('Creando usuario en Supabase Auth...', email);
  
  const { data, error } = await supabase.auth.signUp({
    email: email,
    password: 'Admin123+',
  });

  if (error) {
    console.log('Nota (Supabase):', error.message);
  } else {
    console.log('Usuario registrado en Supabase Auth.');
  }

  console.log('Creando/Actualizando en Prisma DB vía PG...');
  
  const query = `
    INSERT INTO "User" (id, email, role, status, "createdAt") 
    VALUES (gen_random_uuid(), $1, 'SUPERADMIN', 'ACTIVE', now())
    ON CONFLICT (email) 
    DO UPDATE SET role = 'SUPERADMIN', status = 'ACTIVE'
    RETURNING *;
  `;
  
  try {
    const res = await pool.query(query, [email]);
    console.log('¡Super Admin listo en Base de Datos!', res.rows[0]);
  } catch (err) {
    console.error('Error insertando en BD:', err.message);
  }
}

main()
  .catch(console.error)
  .finally(() => pool.end());
