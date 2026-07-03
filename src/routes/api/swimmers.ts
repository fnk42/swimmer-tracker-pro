import { createFileRoute } from "@tanstack/react-router";
import { getSupabase } from "@/lib/supabase";

export const Route = createFileRoute("/api/swimmers")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { data, error } = await getSupabase()
            .from("swimmers")
            .select("*")
            .order("created_at", { ascending: false });

          if (error) throw error;

          return new Response(JSON.stringify(data || []), {
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          console.error("GET /api/swimmers error:", err);
          return new Response(
            JSON.stringify({ error: "Failed to fetch swimmers" }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
      // Single body → add one swimmer. Array body → bulk import (dedupes by
      // name against existing roster + within the batch).
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const sb = getSupabase();

          if (Array.isArray(body)) {
            if (body.length === 0) {
              return new Response(
                JSON.stringify({ imported: [], skipped: [] }),
                { headers: { "content-type": "application/json" } },
              );
            }
            const { data: existing, error: existingErr } = await sb
              .from("swimmers")
              .select("name");
            if (existingErr) throw existingErr;
            const seen = new Set(
              (existing ?? []).map((s: { name: string }) => s.name.trim().toLowerCase()),
            );

            const toInsert: Array<{
              name: string;
              age?: number;
              gender?: "Male" | "Female";
            }> = [];
            const skipped: Array<{ name: string; reason: string }> = [];
            body.forEach((r: { name?: string; age?: number; gender?: "Male" | "Female" }) => {
              const key = (r.name ?? "").trim().toLowerCase();
              if (!key) {
                skipped.push({ name: r.name ?? "", reason: "Missing name" });
                return;
              }
              if (seen.has(key)) {
                skipped.push({
                  name: r.name ?? "",
                  reason: "Duplicate — already in roster",
                });
                return;
              }
              seen.add(key);
              toInsert.push({
                name: (r.name ?? "").trim(),
                age: r.age,
                gender: r.gender,
              });
            });
            if (toInsert.length === 0) {
              return new Response(JSON.stringify({ imported: [], skipped }), {
                headers: { "content-type": "application/json" },
              });
            }
            const { data: inserted, error } = await sb
              .from("swimmers")
              .insert(toInsert)
              .select();
            if (error) throw error;
            return new Response(
              JSON.stringify({ imported: inserted ?? [], skipped }),
              { headers: { "content-type": "application/json" } },
            );
          }

          if (!body.name || !String(body.name).trim()) {
            return new Response(
              JSON.stringify({ error: "name required" }),
              { status: 400, headers: { "content-type": "application/json" } },
            );
          }
          const { data, error } = await sb
            .from("swimmers")
            .insert({
              name: String(body.name).trim(),
              age: body.age,
              gender: body.gender,
            })
            .select()
            .single();
          if (error) throw error;
          return new Response(JSON.stringify(data), {
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          console.error("POST /api/swimmers error:", err);
          return new Response(
            JSON.stringify({ error: "Failed to add swimmer(s)" }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});
