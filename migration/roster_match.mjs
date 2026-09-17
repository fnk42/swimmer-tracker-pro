// Compare the analytics roster against the swimmers already in the database.
// Writes nothing — produces a report for a human to approve.
//
//   node migration/roster_match.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const NG = join(process.env.HOME, 'Claude Projects/NextGen');
const url = readFileSync(join(root,'.env'),'utf8').split('\n')
  .find(l => l.startsWith('DATABASE_URL=')).slice(13).trim();

const norm = (s) => {
  s = s.normalize('NFKD').replace(/\b(Dr|Mr|Mrs|Ms|Miss|Prof)\.?\b/gi,' ').replace(/[^A-Za-z, ]/g,' ');
  const [a,b] = s.includes(',') ? [s.split(',')[1], s.split(',')[0]] : [s, ''];
  return (a+' '+b).split(/\s+/).filter(w=>w.length>1).map(w=>w.toLowerCase()).sort().join(' ');
};
// crude edit distance, for catching Kosgey vs Kosgei
const near = (a,b) => {
  if (Math.abs(a.length-b.length) > 2) return 99;
  const d = Array.from({length:a.length+1},(_,i)=>[i,...Array(b.length).fill(0)]);
  for (let j=0;j<=b.length;j++) d[0][j]=j;
  for (let i=1;i<=a.length;i++) for (let j=1;j<=b.length;j++)
    d[i][j] = Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  return d[a.length][b.length];
};

// analytics roster, with the details we can carry across
const rows = readFileSync(join(NG,'data/results_enriched.csv'),'utf8').split('\n');
const head = rows[0].split(','); const ix = (n)=>head.indexOf(n);
const ath = new Map();
for (const line of rows.slice(1)) {
  if (!line.trim()) continue;
  const c = line.match(/("([^"]|"")*"|[^,]*)/g).filter((_,i)=>i%2===0).map(v=>v.replace(/^"|"$/g,'').replace(/""/g,'"'));
  const name = c[ix('swimmer')]; if (!name) continue;
  const rec = ath.get(name) ?? { name, ages:new Set(), sexes:new Set(), last:'' };
  if (c[ix('age')]) rec.ages.add(Number(c[ix('age')]));
  if (c[ix('sex')]) rec.sexes.add(c[ix('sex')]);
  if (c[ix('meet_start')] > rec.last) rec.last = c[ix('meet_start')];
  ath.set(name, rec);
}

const client = new pg.Client({ connectionString:url, ssl:{rejectUnauthorized:true} });
await client.connect();
const db = (await client.query(`
  select s.id, s.name, s.age, s.gender,
         (select count(*) from public.swimmer_parents sp where sp.swimmer_id=s.id)::int parents
  from public.swimmers s order by s.name`)).rows;

const dbByNorm = new Map(db.map(d => [norm(d.name), d]));
const exact = [], fuzzy = [], newOnes = [];
for (const [name, rec] of ath) {
  const k = norm(name);
  if (dbByNorm.has(k)) { exact.push({ rec, db: dbByNorm.get(k) }); continue; }
  let best = null, bestD = 99;
  for (const d of db) { const dist = near(k, norm(d.name)); if (dist < bestD) { bestD = dist; best = d; } }
  if (best && bestD <= 2) fuzzy.push({ rec, db: best, dist: bestD });
  else newOnes.push(rec);
}
const matchedIds = new Set([...exact, ...fuzzy].map(x => x.db.id));
const dbOnly = db.filter(d => !matchedIds.has(d.id));

const age = (r) => r.ages.size ? Math.max(...r.ages) : '';
const sex = (r) => [...r.sexes][0] === 'F' ? 'Female' : [...r.sexes][0] === 'M' ? 'Male' : '';

console.log(`analytics athletes ${ath.size}   database swimmers ${db.length}\n`);
console.log(`EXACT NAME MATCH  ${exact.length}  (link straight through)`);
console.log(`NEEDS YOUR CALL   ${fuzzy.length}  (near-identical spelling)`);
for (const f of fuzzy)
  console.log(`   analytics "${f.rec.name}"  vs  database "${f.db.name}"   [${f.dist} char diff, ${f.db.parents} parent(s) linked]`);
console.log(`\nNEW TO THE DATABASE ${newOnes.length}  (would be inserted)`);
console.log('   ' + newOnes.slice(0,6).map(r=>r.name).join('; ') + (newOnes.length>6 ? ` … +${newOnes.length-6}` : ''));
console.log(`\nDATABASE ONLY ${dbOnly.length}  (in Machakos, no meet results — left alone)`);
for (const d of dbOnly) console.log(`   ${d.name}  [${d.parents} parent(s) linked]`);

writeFileSync(join(root,'migration/roster_match.csv'),
  'decision,analytics_name,db_name,db_id,age,sex,db_parents\n' +
  exact.map(e=>`link,"${e.rec.name}","${e.db.name}",${e.db.id},${age(e.rec)},${sex(e.rec)},${e.db.parents}`).join('\n') + '\n' +
  fuzzy.map(f=>`REVIEW,"${f.rec.name}","${f.db.name}",${f.db.id},${age(f.rec)},${sex(f.rec)},${f.db.parents}`).join('\n') + '\n' +
  newOnes.map(r=>`insert,"${r.name}",,,${age(r)},${sex(r)},0`).join('\n') + '\n');
console.log('\nWrote migration/roster_match.csv');
await client.end();
