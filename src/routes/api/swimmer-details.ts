import { createFileRoute } from "@tanstack/react-router";
import { q, json } from "@/lib/db";
import { viewer } from "@/lib/scope";
import db from "@/tracker/swimmers_db.json";

// Correcting a swimmer's details by hand.
//
// A birth date decides which age band a swimmer is judged in, so a wrong one
// moves their whole assessment. The archive infers most of them from the six
// digits at the front of the athlete ID, which was wrong for 3 of the 288
// swimmers in the first export to carry a real date — and 26 swimmers have no
// date at all, because a PDF-only meet carries no athlete ID.
//
// Append-only. Correcting a correction leaves both rows: who changed what and
// when is the record. tools/pull_swimmer_details.mjs carries the latest of
// each into data/dob_overrides.csv, which already beats both the export field
// and the ID.
//
// Admins only. This is children's dates of birth.

type Row = {
  swimmer: string; dob: string | null; sex: string | null;
  note: string | null; edited_by: string; created_at: string;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export const Route = createFileRoute("/api/swimmer-details")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const v = await viewer(request);
        if (!v) return json({ error: "Not signed in" }, 401);
        if (v.scope !== "coach") return json({ error: "Admins only" }, 403);

        const edits = await q<Row>(
          `select swimmer, dob::text, sex, note, edited_by, created_at
             from public.swimmer_details_current order by created_at desc`,
        );
        const by = new Map(edits.map((e) => [e.swimmer, e]));
        return json({
          ...db,
          swimmers: db.swimmers.map((s) => ({ ...s, edit: by.get(s.swimmer) ?? null })),
          // An edit reaches the figures on the next pipeline run, not on save.
          pending: edits.length,
        });
      },

      POST: async ({ request }) => {
        const v = await viewer(request);
        if (!v) return json({ error: "Not signed in" }, 401);
        if (v.scope !== "coach") return json({ error: "Admins only" }, 403);

        const b = (await request.json()) as {
          swimmer?: string; dob?: string; sex?: string; note?: string;
        };
        const swimmer = (b.swimmer ?? "").trim();
        const dob = (b.dob ?? "").trim();
        const sex = (b.sex ?? "").trim();

        // Only names the archive already knows, so a typo cannot invent a
        // swimmer or attach a date to nobody.
        if (!db.swimmers.some((s) => s.swimmer === swimmer)) {
          return json({ error: "That swimmer is not in the archive" }, 400);
        }
        if (dob && !ISO.test(dob)) return json({ error: "Date must be YYYY-MM-DD" }, 400);
        if (dob) {
          const d = new Date(dob + "T00:00:00Z");
          if (Number.isNaN(d.getTime())) return json({ error: "That is not a real date" }, 400);
          const year = d.getUTCFullYear();
          const now = new Date();
          if (year < 1930 || d > now) {
            return json({ error: "A birth date must be in the past and after 1930" }, 400);
          }
          // Checked against the ages the meets themselves recorded, so a
          // slipped digit is caught at the keyboard rather than three pages
          // later in a development band.
          const rec = db.swimmers.find((s) => s.swimmer === swimmer)!;
          const off = (rec.agesSeen as [string, number][]).filter(([y, age]) => {
            const at = new Date(Date.UTC(Number(y), 6, 1));
            const calc = Math.floor((at.getTime() - d.getTime()) / 31557600000);
            return Math.abs(calc - age) > 1;
          });
          if (off.length && off.length === (rec.agesSeen as unknown[]).length) {
            return json({
              error:
                `That date disagrees with every age the meets recorded for ${swimmer} ` +
                `(${off.map(([y, a]) => `${a} in ${y}`).join(", ")}). ` +
                `Add a note saying why if it is right anyway.`,
              needsNote: true,
            }, 409);
          }
        }
        if (sex && sex !== "F" && sex !== "M") return json({ error: "Sex must be F or M" }, 400);

        await q(
          `insert into public.swimmer_details (swimmer, dob, sex, note, edited_by)
           values ($1, $2::date, $3, $4, $5)`,
          [swimmer, dob || null, sex || null, (b.note ?? "").trim() || null, v.email],
        );
        return json({ ok: true });
      },
    },
  },
});
