import { createFileRoute } from "@tanstack/react-router";
import { q, one, json, fail } from "@/lib/db";
import { maySeeAssessment, viewer } from "@/lib/scope";
import { note } from "@/lib/activity";
import { areaById, report, type AssessmentBody, type ItemMark } from "@/lib/assessment-template";

// Coaches' assessments of one child (Felix, 21 Oct 2026).
//
// Coaches and admins read and write every child's. A parent reads only the
// SHARED ones, and only for their own child — the same rule as the data
// protection notice: "assessments and coaching notes about a child are seen
// only by the club's coaches, its administrators, and that child's own
// parents or guardians". A draft stays with the coaches.
//
// One child per request, like /api/athlete/assessment, and parents' reads are
// logged to assessment_views so "who has looked at my child's assessment?"
// has an answer.
//
// For now the whole feature is private to the addresses in ASSESSMENT_EMAILS
// (Felix, 21 Oct 2026): it is shown to the club before it is opened to
// coaches and parents. Unset means nobody. Everyone else gets a 404, so the
// feature does not announce itself.

const allowed = (email: string) =>
  (process.env.ASSESSMENT_EMAILS ?? "")
    .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
    .includes(email.trim().toLowerCase());
const hidden = () => json({ error: "Not found" }, 404);

type Row = {
  id: string;
  analytics_name: string;
  area: string;
  filmed_on: string | Date;
  body: AssessmentBody;
  shared: boolean;
  coach_email: string;
  coach_name: string | null;
  updated_at: string;
};

const isCoachView = (v: { scope: string }, request: Request) =>
  v.scope === "coach" && new URL(request.url).searchParams.get("as") !== "parent";

// node-postgres hands a date column back as a Date at local midnight;
// String() of that is "Wed Oct 21 2026 …", not the date.
const ymd = (d: unknown) => {
  if (!(d instanceof Date)) return String(d).slice(0, 10);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const shape = (r: Row, coach: boolean) => ({
  id: r.id,
  name: r.analytics_name,
  area: r.area,
  filmedOn: ymd(r.filmed_on),
  shared: r.shared,
  coachName: r.coach_name || "A NextGen coach",
  updatedAt: r.updated_at,
  report: report(r.body),
  // The raw marks are only needed to edit, which only a coach does.
  ...(coach ? { body: r.body, mine: true } : {}),
});

/** Checks a body against the template; returns an error message or null. */
function invalid(b: AssessmentBody): string | null {
  const area = areaById(b.area);
  if (!area) return "Choose what was assessed";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.filmedOn)) return "Give the date it was filmed";
  const ids = new Set(area.phases.flatMap((p) => p.items.map((i) => i.id)));
  const marks = Object.entries(b.marks ?? {});
  if (!marks.length) return "Mark at least one point";
  for (const [id, m] of marks) {
    if (!ids.has(id)) return "That form is out of date. Reload and try again";
    if (m.mark !== "good" && m.mark !== "work") return "Each point is either good or one to work on";
    if (m.side && !["left", "right", "both"].includes(m.side)) return "Unknown side";
    if ((m.note ?? "").length > 400) return "A point's note is too long";
  }
  if ((b.priorities ?? []).length > 3) return "Pick up to three priorities";
  for (const id of b.priorities ?? []) {
    if (b.marks[id]?.mark !== "work") return "Priorities come from the points to work on";
  }
  if ((b.note ?? "").length > 2000) return "The summary is too long";
  if ((b.filmed ?? "").length > 300) return "The filming line is too long";
  return null;
}

function clean(b: AssessmentBody): AssessmentBody {
  const marks: Record<string, ItemMark> = {};
  for (const [id, m] of Object.entries(b.marks)) {
    marks[id] = {
      mark: m.mark,
      ...(m.side && m.mark === "work" ? { side: m.side } : {}),
      ...(m.note?.trim() ? { note: m.note.trim() } : {}),
    };
  }
  return {
    area: b.area,
    filmedOn: b.filmedOn,
    filmed: (b.filmed ?? "").trim(),
    marks,
    priorities: [...new Set(b.priorities ?? [])],
    note: (b.note ?? "").trim(),
  };
}

export const Route = createFileRoute("/api/coach/assessments")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const v = await viewer(request);
          if (!v) return json({ error: "Not signed in" }, 401);
          if (!allowed(v.email)) return hidden();
          const url = new URL(request.url);
          if (url.searchParams.get("probe")) return json({ ok: true });
          const coach = isCoachView(v, request);

          const id = url.searchParams.get("id");
          if (id) {
            if (!coach) return json({ error: "Coaches only" }, 403);
            const r = await one<Row>(`select * from public.coach_assessments where id = $1::uuid`, [id]);
            if (!r) return json({ error: "Not found" }, 404);
            return json(shape(r, true));
          }

          const name = url.searchParams.get("name")?.trim() ?? "";
          if (!name) return json({ error: "name required" }, 400);
          if (!coach && !maySeeAssessment(v, name)) {
            return json({ error: "Assessments are shown to the coaches and to that swimmer's own parents." }, 403);
          }
          const rows = await q<Row>(
            `select * from public.coach_assessments
              where analytics_name = $1 ${coach ? "" : "and shared"}
              order by filmed_on desc, updated_at desc`,
            [name],
          );
          if (!coach && rows.length) {
            await q(`insert into public.assessment_views (viewer_email, analytics_name) values ($1, $2)`,
              [v.email, name]).catch(() => {});
          }
          return new Response(JSON.stringify(rows.map((r) => shape(r, coach))), {
            headers: { "content-type": "application/json", "cache-control": "private, no-store" },
          });
        } catch (err) {
          return fail("GET /api/coach/assessments", err, "Could not load the assessments");
        }
      },

      POST: async ({ request }) => {
        try {
          const v = await viewer(request);
          if (!v || v.scope !== "coach") return json({ error: "Coaches only" }, 403);
          if (!allowed(v.email)) return hidden();
          const b = (await request.json().catch(() => ({}))) as {
            id?: string; name?: string; shared?: boolean; body?: AssessmentBody;
          };
          const name = String(b.name ?? "").trim();
          if (!name) return json({ error: "Choose a swimmer" }, 400);
          const known = await one<{ n: number }>(
            `select count(*)::int n from public.swimmers where analytics_name = $1`, [name]);
          if (!known?.n) return json({ error: "That swimmer is not on the club's records" }, 400);
          if (!b.body) return json({ error: "Nothing to save" }, 400);
          const bad = invalid(b.body);
          if (bad) return json({ error: bad }, 400);
          const body = clean(b.body);
          const who = v.parentId
            ? await one<{ n: string }>(`select coalesce(full_name,'') n from public.parents where id = $1`, [v.parentId])
            : null;
          const coachName = who?.n.trim() || null;

          let row: Row | null;
          if (b.id) {
            row = await one<Row>(
              `update public.coach_assessments
                  set analytics_name = $2, area = $3, filmed_on = $4::date, body = $5::jsonb,
                      shared = $6, updated_at = now()
                where id = $1::uuid
                returning *`,
              [b.id, name, body.area, body.filmedOn, JSON.stringify(body), !!b.shared],
            );
            if (!row) return json({ error: "That assessment no longer exists" }, 404);
          } else {
            row = await one<Row>(
              `insert into public.coach_assessments
                 (analytics_name, area, filmed_on, body, shared, coach_email, coach_name)
               values ($1, $2, $3::date, $4::jsonb, $5, $6, $7)
               returning *`,
              [name, body.area, body.filmedOn, JSON.stringify(body), !!b.shared, v.email, coachName],
            );
          }
          await note("assessment_saved", {
            email: v.email, parentId: v.parentId ?? undefined,
            detail: `${areaById(body.area)?.name} for ${name}${b.shared ? " (shared with parents)" : " (draft)"}`,
          });
          return json(shape(row!, true));
        } catch (err) {
          return fail("POST /api/coach/assessments", err, "Could not save that assessment");
        }
      },

      DELETE: async ({ request }) => {
        try {
          const v = await viewer(request);
          if (!v || v.scope !== "coach") return json({ error: "Coaches only" }, 403);
          if (!allowed(v.email)) return hidden();
          const b = (await request.json().catch(() => ({}))) as { id?: string };
          if (!b.id) return json({ error: "id required" }, 400);
          // The coach who wrote it, or an admin.
          const gone = await one<{ analytics_name: string; area: string }>(
            `delete from public.coach_assessments
              where id = $1::uuid and ($2 or lower(coach_email) = lower($3))
              returning analytics_name, area`,
            [b.id, v.isAdmin, v.email],
          );
          if (!gone) return json({ error: "Only the coach who wrote it, or an admin, can delete it" }, 403);
          await note("assessment_deleted", {
            email: v.email, parentId: v.parentId ?? undefined,
            detail: `${gone.area} for ${gone.analytics_name}`,
          });
          return json({ ok: true });
        } catch (err) {
          return fail("DELETE /api/coach/assessments", err, "Could not delete that assessment");
        }
      },
    },
  },
});
