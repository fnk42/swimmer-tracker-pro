// Apply a one-off SQL file:  node migration/apply.mjs migration/03_auth.sql
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const url = readFileSync(join(root,'.env'),'utf8').split('\n')
  .find(l => l.startsWith('DATABASE_URL=')).slice(13).trim();
const file = process.argv[2];
if (!file) { console.error('usage: node migration/apply.mjs <file.sql>'); process.exit(1); }
const c = new pg.Client({ connectionString: url, ssl:{rejectUnauthorized:true} });
await c.connect();
await c.query(readFileSync(file,'utf8'));
console.log(`applied ${file}`);
const t = await c.query(`select table_name from information_schema.tables
                         where table_schema='public' order by table_name`);
console.log('tables:', t.rows.map(r=>r.table_name).join(', '));
await c.end();
