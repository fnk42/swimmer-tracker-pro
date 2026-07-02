import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import type { Registration } from "@/lib/supabase";

export const Route = createFileRoute("/api/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();

          if (
            !body.swimmerId ||
            !body.age ||
            !body.gender ||
            !body.parent1Name ||
            !body.primaryPhone
          ) {
            return new Response(
              JSON.stringify({ error: "Missing required fields" }),
              { status: 400, headers: { "content-type": "application/json" } },
            );
          }

          const registration: Registration = {
            swimmer_id: body.swimmerId,
            age: body.age,
            gender: body.gender,
            parent_sleepover: body.parentSleepover,
            owns_cellphone: body.ownsCellphone,
            parent1_name: body.parent1Name,
            parent2_name: body.parent2Name,
            primary_phone: body.primaryPhone,
            secondary_phone: body.secondaryPhone,
            dietary: body.dietary,
            allergies: body.allergies,
            health_conditions: body.healthConditions,
            special_requests: body.specialRequests,
            updated_at: new Date().toISOString(),
          };

          const { data, error } = await supabase
            .from("registrations")
            .upsert(registration, { onConflict: "swimmer_id" })
            .select()
            .single();

          if (error) throw error;

          return new Response(JSON.stringify(data), {
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          console.error("POST /api/register error:", err);
          return new Response(
            JSON.stringify({ error: "Failed to save registration" }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});
