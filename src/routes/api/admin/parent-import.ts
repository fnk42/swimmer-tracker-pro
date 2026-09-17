import { createFileRoute } from "@tanstack/react-router";
import { q, json, fail, tx } from "@/lib/db";
import { requireAdmin, sessionFromRequest } from "@/lib/session";
import { normalizeKePhone } from "@/lib/phone";

// Import the club's own list of parents.
//
// Boit holds the real list. Until it is in here, a parent who signs up has to
// be matched by hand, and 166 of the 190 swimmers have no adult attached at
// all. This is the fastest way to close that.
//
// Two passes, deliberately separated:
//
//   POST ?preview=1   parse, match, and hand back what WOULD happen. Nothing
//                     is written. Surnames are common — Mwangi, Otieno — so a
//                     surname hit on more than one swimmer is reported as
//                     ambiguous rather than picked.
//   POST              apply only the rows the coordinator confirmed.
//
// A match found this way is APPROVED, not pending: it comes from the club's own
// record, vouched for by a coordinator looking at the preview. A parent
// claiming a child themselves still starts pending — that is a different thing.

type Incoming = { name: string; email: string; phone: string; children?: string };

const norm = (s: string) => (s || "").trim().replace(/\s+/g, " ");
const lower = (s: string) => norm(s).toLowerCase();
const digits = (s: string) => (normalizeKePhone(s) || s || "").replace(/\D/g, "").slice(-9);

/** Comparable name tokens, middle initials dropped. */
function tokens(name: string): Set<string> {
  return new Set(
    lower(name)
      .replace(/[^a-z' ,]/g, " ")
      .split(/[\s,]+/)
      .filter((w) => w.length > 1),
  );
}

/** Do two names share every token of the shorter one? */
function overlaps(a: Set<string>, b: Set<string>): boolean {
  if (!a.size || !b.size) return false;
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  for (const t of small) if (!big.has(t)) return false;
  return true;
}

/** Surname = last word, minus anything that is not a letter. */
function surname(full: string): string {
  const words = lower(full)
    .replace(/[^a-z' ]/g, " ")
    .split(" ")
    .filter((w) => w.length > 1);
  return words.length ? words[words.length - 1] : "";
}

/** Parse pasted text or CSV. Tolerant about column order and headers. */
function parseList(text: string): Incoming[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const split = (l: string) =>
    l.includes("\t") ? l.split("\t") : l.split(",").map((c) => c.replace(/^"|"$/g, ""));

  // Work out which column is which from the header if there is one, otherwise
  // guess by shape: an @ is an email, mostly-digits is a phone.
  let cols: string[] | null = null;
  const head = split(lines[0]).map(lower);
  const looksLikeHeader = head.some((h) => /name|email|phone|mobile|parent|child|swimmer/.test(h));
  if (looksLikeHeader) cols = head;

  const out: Incoming[] = [];
  for (const line of lines.slice(looksLikeHeader ? 1 : 0)) {
    const cells = split(line).map(norm);
    let name = "";
    let email = "";
    let phone = "";
    let children = "";

    if (cols) {
      cols.forEach((c, i) => {
        const v = cells[i] ?? "";
        if (/email/.test(c)) email = v;
        else if (/phone|mobile|tel/.test(c)) phone = v;
        else if (/child|swimmer|kid/.test(c)) children = v;
        else if (/name/.test(c) && !name) name = v;
      });
    }
    // Fill anything the header did not give us, by shape.
    for (const v of cells) {
      if (!email && v.includes("@")) email = v;
      else if (!phone && v.replace(/\D/g, "").length >= 9 && !v.includes("@")) phone = v;
      else if (!name && /[a-z]{2,}/i.test(v) && !v.includes("@")) name = v;
    }

    if (!name && !email) continue;
    out.push({ name: norm(name), email: lower(email), phone: norm(phone), children });
  }
  return out;
}

export const Route = createFileRoute("/api/admin/parent-import")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const denied = requireAdmin(request);
          if (denied) return denied;
          const s = sessionFromRequest(request);
          const preview = new URL(request.url).searchParams.get("preview") === "1";

          const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          const rows = Array.isArray(b.rows)
            ? (b.rows as Incoming[])
            : parseList(String(b.text ?? ""));
          if (!rows.length) return json({ error: "Nothing to import — paste or upload a list" }, 400);

          const [swimmers, parents, links] = await Promise.all([
            q<{ id: string; name: string; age: number | null; analytics_name: string | null }>(
              `select id::text, name, age, analytics_name from public.swimmers`,
            ),
            q<{ id: string; email: string; phone: string; full_name: string }>(
              `select id::text, coalesce(email,'') email, coalesce(phone,'') phone,
                      coalesce(full_name,'') full_name
                 from public.parents`,
            ),
            q<{ swimmer_id: string; parent_id: string }>(
              `select swimmer_id::text, parent_id::text from public.swimmer_parents
                where status = 'approved'`,
            ),
          ]);

          const bySurname = new Map<string, typeof swimmers>();
          for (const sw of swimmers) {
            const k = surname(sw.name);
            if (!k) continue;
            if (!bySurname.has(k)) bySurname.set(k, []);
            bySurname.get(k)!.push(sw);
          }
          const approvedCount = new Map<string, number>();
          for (const l of links) {
            approvedCount.set(l.swimmer_id, (approvedCount.get(l.swimmer_id) ?? 0) + 1);
          }

          const result = rows.map((r) => {
            const existing =
              parents.find((p) => r.email && lower(p.email) === lower(r.email)) ??
              (digits(r.phone)
                ? parents.find((p) => digits(p.phone) === digits(r.phone))
                : undefined);

            // Children named explicitly in the list beat a surname guess.
            //
            // Matched on token overlap against BOTH the portal name and the
            // archive name, because they disagree: Michael appears as "Michael
            // Mutunga" in the portal and "Masua, Michael" in the meets. An
            // exact-string lookup missed him and the surname fallback then
            // offered his brother instead, which is the worst possible answer.
            const named = (r.children ?? "")
              .split(/[;,/]| and /i)
              .map(norm)
              .filter((x) => x.length > 1);

            const namedResolved = named.map((n) => {
              const want = tokens(n);
              const hits = swimmers.filter((sw) => {
                const a = tokens(sw.name);
                const b = tokens(sw.analytics_name ?? "");
                return overlaps(want, a) || overlaps(want, b);
              });
              return { asked: n, hits };
            });

            const byName = namedResolved.flatMap((x) => (x.hits.length === 1 ? x.hits : []));
            // A child was named and we could not pin them down. Say so — do NOT
            // fall back to a surname guess, which is how the wrong sibling gets
            // linked.
            const unresolved = namedResolved.filter((x) => x.hits.length !== 1);

            const sn = surname(r.name);
            // Surnames are only consulted when the list named nobody at all.
            const bySn = named.length ? [] : (bySurname.get(sn) ?? []);

            const candidates = named.length ? byName : bySn;
            const free = candidates.filter((c) => (approvedCount.get(c.id) ?? 0) < 2);

            return {
              name: r.name,
              email: r.email,
              phone: r.phone,
              surname: sn,
              existingParentId: existing?.id ?? null,
              // Named children, or a surname that hits exactly one swimmer, is
              // safe to tick by default. More than one is a decision.
              matched: free.map((c) => ({ id: c.id, name: c.name, age: c.age })),
              // Children the list named that we could not resolve to exactly
              // one swimmer, with what we did find, so a coordinator can fix it.
              unresolved: unresolved.map((u) => ({
                asked: u.asked,
                couldBe: u.hits.map((h) => h.name).slice(0, 4),
              })),
              confident: named.length ? byName.length > 0 && !unresolved.length : free.length === 1,
              ambiguous: unresolved.length > 0 || (!named.length && free.length > 1),
              noMatch: free.length === 0 && !unresolved.length,
            };
          });

          if (preview) {
            return json({
              rows: result,
              summary: {
                total: result.length,
                confident: result.filter((r) => r.confident).length,
                ambiguous: result.filter((r) => r.ambiguous).length,
                noMatch: result.filter((r) => r.noMatch).length,
                alreadyKnown: result.filter((r) => r.existingParentId).length,
              },
            });
          }

          // Apply. Only what came back in `rows` is written, so the coordinator
          // decides — including for the ambiguous ones.
          const applied = await tx(async (c) => {
            let parentsAdded = 0;
            let linksAdded = 0;
            for (const r of result) {
              if (!r.email && !r.phone) continue;

              let pid = r.existingParentId;
              if (!pid) {
                const ins = await c.query(
                  `insert into public.parents (full_name, email, phone)
                   values ($1, nullif($2,''), nullif($3,''))
                   returning id::text`,
                  [r.name || null, r.email, r.phone],
                );
                pid = ins.rows[0].id as string;
                parentsAdded += 1;
              } else {
                await c.query(
                  `update public.parents
                      set full_name = coalesce(nullif(full_name,''), $2),
                          phone     = coalesce(nullif(phone,''), nullif($3,'')),
                          updated_at = now()
                    where id = $1`,
                  [pid, r.name || null, r.phone],
                );
              }

              for (const m of r.matched) {
                // Approved: this came from the club's own list, confirmed by a
                // coordinator looking at the preview.
                const done = await c.query(
                  `insert into public.swimmer_parents
                     (swimmer_id, parent_id, sort_order, status, decided_at, decided_by, decided_note)
                   select $1, $2,
                          coalesce((select max(sort_order) + 1 from public.swimmer_parents
                                     where swimmer_id = $1), 1),
                          'approved', now(), $3, 'from the club parent list'
                    where (select count(*) from public.swimmer_parents
                            where swimmer_id = $1 and status = 'approved') < 2
                   on conflict (swimmer_id, parent_id) do nothing`,
                  [m.id, pid, s?.email ?? "import"],
                );
                linksAdded += done.rowCount ?? 0;
              }
            }
            return { parentsAdded, linksAdded };
          });

          return json({ ok: true, ...applied });
        } catch (err) {
          return fail("POST /api/admin/parent-import", err, "Could not import that list");
        }
      },
    },
  },
});
