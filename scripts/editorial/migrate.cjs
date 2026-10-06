const fs=require('node:fs');
const {Client}=require('pg');
require('dotenv').config({quiet:true});
(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();try{await c.query('BEGIN');await c.query(fs.readFileSync('scripts/editorial/schema.sql','utf8'));await c.query('COMMIT');console.log('Editorial job schema ready');}catch(e){await c.query('ROLLBACK');throw e;}finally{await c.end();}})().catch(()=>{console.error('Editorial migration failed');process.exitCode=1;});
