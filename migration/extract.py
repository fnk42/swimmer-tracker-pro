#!/usr/bin/env python3
"""
Turn the Supabase cluster backup into portable Postgres that Neon can take.

    python3 migration/extract.py <backup-file>

Writes 01_schema.sql and 02_data.sql next to this script.

What changes, and why:
  * extensions.uuid_generate_v4()  ->  gen_random_uuid()   (built in since PG13)
  * RLS policies are NOT carried over. They depended on Supabase's auth.uid(),
    and four of them granted the PUBLIC anon key full read/write/delete on
    parents, registrations, payments and swimmer_parents. In the new design the
    browser never talks to the database at all - every query goes through a
    server route holding the connection string - so there is no anon key to
    abuse and nothing to leak.
  * parents.user_id is kept as a plain uuid for provenance, but it no longer
    references Supabase's auth.users. Email is the identity going forward;
    all 20 parents have one.
"""
import re, sys, os

SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser(
    "~/Downloads/db_cluster-17-08-2026@01-17-33.backup")
OUT = os.path.dirname(os.path.abspath(__file__))
TABLES = ['swimmers', 'parents', 'swimmer_parents', 'registrations', 'payments']

txt = open(SRC, encoding='utf-8', errors='replace').read()
lines = txt.split('\n')

# ---- data ----------------------------------------------------------------
blocks = {}
i = 0
while i < len(lines):
    m = re.match(r'^COPY public\.(\w+) \((.*?)\) FROM stdin', lines[i])
    if m:
        t, cols = m.group(1), [c.strip() for c in m.group(2).split(',')]
        j, rows = i + 1, []
        while j < len(lines) and lines[j] != '\\.':
            if lines[j].strip():
                rows.append(lines[j].split('\t'))
            j += 1
        blocks[t] = (cols, rows)
        i = j
    i += 1

def lit(v):
    if v == '\\N':
        return 'NULL'
    v = (v.replace('\\t', '\t').replace('\\n', '\n')
          .replace('\\r', '\r').replace('\\\\', '\\'))
    return "'" + v.replace("'", "''") + "'"

# ---- schema --------------------------------------------------------------
ddl = []
for t in TABLES:
    m = re.search(r'CREATE TABLE public\.%s \((.*?)\n\);' % t, txt, re.S)
    body = m.group(1).replace('extensions.uuid_generate_v4()', 'gen_random_uuid()')
    ddl.append("CREATE TABLE public.%s (%s\n);" % (t, body))

extras = []
for pat in (r'ALTER TABLE ONLY public\.\w+\s+ADD CONSTRAINT [^;]+;',
            r'CREATE (?:UNIQUE )?INDEX \w+ ON public\.[^;]+;'):
    extras += [' '.join(x.group(0).split()) for x in re.finditer(pat, txt)]
pk  = [x for x in extras if 'PRIMARY KEY' in x]
fk  = [x for x in extras if 'FOREIGN KEY' in x]
idx = [x for x in extras if x.startswith('CREATE')]

with open(os.path.join(OUT, '01_schema.sql'), 'w') as f:
    f.write("-- NextGen / Machakos 2026 — schema for Neon\n")
    f.write("-- Generated from the Supabase cluster backup by migration/extract.py\n")
    f.write("-- No RLS: access control lives in the server routes, not the database,\n")
    f.write("-- because the browser no longer holds a database key.\n\n")
    f.write("BEGIN;\n\n")
    f.write('\n\n'.join(ddl))
    f.write("\n\n-- primary keys\n"   + '\n'.join(pk))
    f.write("\n\n-- foreign keys\n"   + '\n'.join(fk))
    f.write("\n\n-- indexes\n"        + '\n'.join(idx))
    f.write("\n\nCOMMIT;\n")

with open(os.path.join(OUT, '02_data.sql'), 'w') as f:
    f.write("-- Data as at the 17 Aug 2026 backup (last real activity 4 Aug).\n")
    f.write("-- Insert order respects foreign keys.\n\nBEGIN;\n\n")
    total = 0
    for t in TABLES:
        cols, rows = blocks[t]
        f.write("-- %s (%d rows)\n" % (t, len(rows)))
        for r in rows:
            f.write("INSERT INTO public.%s (%s) VALUES (%s);\n"
                    % (t, ', '.join(cols), ', '.join(lit(v) for v in r)))
        f.write("\n")
        total += len(rows)
    f.write("COMMIT;\n")

print("wrote 01_schema.sql and 02_data.sql")
for t in TABLES:
    print("   %-18s %3d rows" % (t, len(blocks[t][1])))
print("   %-18s %3d rows total" % ('', sum(len(blocks[t][1]) for t in TABLES)))
