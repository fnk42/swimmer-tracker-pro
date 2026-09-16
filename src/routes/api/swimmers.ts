import { createFileRoute } from "@tanstack/react-router";
import { q, one, json, fail } from "@/lib/db";

type SwimmerRow = {
  id: string; name: string; age: number | null;
  gender: "Male" | "Female" | null; created_at: string; updated_at: string;
};

export const Route = createFileRoute("/api/swimmers")({
  server: {
    handlers: {
      GET: async () => {
        try {
          return json(
            await q<SwimmerRow>(
              `select * from public.swimmers order by created_at desc`,
            ),
          );
        } catch (err) {
          return fail("GET /api/swimmers", err, "Failed to fetch swimmers");
        }
      },

      // Single body -> add one swimmer. Array body -> bulk import, deduped by
      // name against the existing roster and within the batch itself.
      POST: async ({ request }) => {
        try {
          const body = await request.json();

          if (Array.isArray(body)) {
            if (body.length === 0) return json({ imported: [], skipped: [] });

            const existing = await q<{ name: string }>(
              `select name from public.swimmers`,
            );
            const seen = new Set(existing.map((s) => s.name.trim().toLowerCase()));

            const toInsert: Array<{ name: string; age?: number; gender?: string }> = [];
            const skipped: Array<{ name: string; reason: string }> = [];
            for (const r of body as Array<{ name?: string; age?: number; gender?: "Male" | "Female" }>) {
              const key = (r.name ?? "").trim().toLowerCase();
              if (!key) { skipped.push({ name: r.name ?? "", reason: "Missing name" }); continue; }
              if (seen.has(key)) {
                skipped.push({ name: r.name ?? "", reason: "Duplicate — already in roster" });
                continue;
              }
              seen.add(key);
              toInsert.push({ name: (r.name ?? "").trim(), age: r.age, gender: r.gender });
            }
            if (toInsert.length === 0) return json({ imported: [], skipped });

            // one multi-row INSERT rather than a round trip per swimmer
            const vals: unknown[] = [];
            const tuples = toInsert.map((r, i) => {
              vals.push(r.name, r.age ?? null, r.gender ?? null);
              return `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`;
            });
            const imported = await q<SwimmerRow>(
              `insert into public.swimmers (name, age, gender)
               values ${tuples.join(", ")} returning *`,
              vals,
            );
            return json({ imported, skipped });
          }

          if (!body.name || !String(body.name).trim()) {
            return json({ error: "name required" }, 400);
          }
          const row = await one<SwimmerRow>(
            `insert into public.swimmers (name, age, gender)
             values ($1, $2, $3) returning *`,
            [String(body.name).trim(), body.age ?? null, body.gender ?? null],
          );
          return json(row);
        } catch (err) {
          return fail("POST /api/swimmers", err, "Failed to add swimmer(s)");
        }
      },
    },
  },
});
