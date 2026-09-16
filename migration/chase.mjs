// Who still owes what. Run any time:  node migration/chase.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const url = readFileSync(join(root,'.env'),'utf8').split('\n')
  .find(l => l.startsWith('DATABASE_URL=')).slice(13).trim();
const c = new pg.Client({ connectionString: url, ssl:{rejectUnauthorized:false} });
await c.connect();
const FEE = 20910;
const q = await c.query(`
  select s.name,
         (r.swimmer_id is not null) as registered,
         coalesce(sum(p.amount),0)::float as paid
  from public.swimmers s
  left join public.registrations r on r.swimmer_id = s.id
  left join public.payments p      on p.swimmer_id = s.id
  group by s.name, r.swimmer_id
  order by paid asc, s.name`);
const reg = q.rows.filter(r=>r.registered), unreg = q.rows.filter(r=>!r.registered);
const full = reg.filter(r=>r.paid>=FEE), part = reg.filter(r=>r.paid>0&&r.paid<FEE), zero = reg.filter(r=>r.paid===0);
console.log(`registered ${reg.length} of ${q.rows.length} on the roster\n`);
console.log(`  paid in full        ${full.length}`);
console.log(`  part-paid           ${part.length}   owing KES ${part.reduce((a,r)=>a+FEE-r.paid,0).toLocaleString()}`);
console.log(`  registered, nil     ${zero.length}   owing KES ${(zero.length*FEE).toLocaleString()}`);
console.log(`  not registered      ${unreg.length}   potential KES ${(unreg.length*FEE).toLocaleString()}`);
const out = reg.reduce((a,r)=>a+Math.max(0,FEE-r.paid),0);
console.log(`\n  outstanding from those registered : KES ${out.toLocaleString()}`);
console.log(`  total still to collect (all 46)   : KES ${(out+unreg.length*FEE).toLocaleString()}`);
await c.end();
