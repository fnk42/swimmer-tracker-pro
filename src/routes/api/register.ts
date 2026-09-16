import { createFileRoute } from "@tanstack/react-router";
import { one, json, fail } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const Route = createFileRoute("/api/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = requireAdmin(request);
        if (denied) return denied;
        try {
          const b = await request.json();
          if (!b.swimmerId || !b.age || !b.gender || !b.parent1Name || !b.primaryPhone) {
            return json({ error: "Missing required fields" }, 400);
          }
          const row = await one(
            `insert into public.registrations
               (swimmer_id, age, gender, guardian_gender, parent_sleepover,
                owns_cellphone, parent1_name, parent2_name, primary_phone,
                secondary_phone, dietary, allergies, health_conditions,
                special_requests, updated_at)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, now())
             on conflict (swimmer_id) do update set
               age = excluded.age, gender = excluded.gender,
               guardian_gender = excluded.guardian_gender,
               parent_sleepover = excluded.parent_sleepover,
               owns_cellphone = excluded.owns_cellphone,
               parent1_name = excluded.parent1_name,
               parent2_name = excluded.parent2_name,
               primary_phone = excluded.primary_phone,
               secondary_phone = excluded.secondary_phone,
               dietary = excluded.dietary, allergies = excluded.allergies,
               health_conditions = excluded.health_conditions,
               special_requests = excluded.special_requests,
               updated_at = now()
             returning *`,
            [
              b.swimmerId, b.age, b.gender, b.guardianGender ?? null,
              b.parentSleepover, b.ownsCellphone, b.parent1Name,
              b.parent2Name ?? null, b.primaryPhone, b.secondaryPhone ?? null,
              b.dietary ?? null, b.allergies ?? null, b.healthConditions ?? null,
              b.specialRequests ?? null,
            ],
          );
          return json(row);
        } catch (err) {
          return fail("POST /api/register", err, "Failed to save registration");
        }
      },
    },
  },
});
