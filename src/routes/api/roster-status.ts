import { createFileRoute } from "@tanstack/react-router";
import { q, json } from "@/lib/db";
import { viewer } from "@/lib/scope";
import dormant from "@/tracker/dormant.json";

// Who the twelve-month rule has set aside, and putting any of them back.
//
// The rule lives in the pipeline and is mechanical: no NextGen race in twelve
// months and a swimmer stops counting toward club figures. It is right far
// more often than it is wrong, and it cannot know that a child was injured,
// sat exams, or swam at a meet whose results have not reached us.
//
// So it is inspectable and reversible. A decision here is a named person
// overruling the rule with a reason, and tools/pull_reinstatements.mjs carries
// it into data/roster_overrides.csv, which already beats the rule. Nothing is
// deleted: re-archiving someone leaves both rows, because the record of who
// decided what is the point.
//
// Coordinators only. This is a list of children who have stopped turning up,
// which is not something to publish to other families.

type Decision = {
  swimmer: string; decision: string; reason: string | null;
  decided_by: string; created_at: string;
};

export const Route = createFileRoute("/api/roster-status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const v = await viewer(request);
        if (!v) return json({ error: "Not signed in" }, 401);
        if (v.scope !== "coach") return json({ error: "Coordinators only" }, 403);

        const decisions = await q<Decision>(
          `select swimmer, decision, reason, decided_by, created_at
             from public.roster_decision_current order by created_at desc`,
        );
        const by = new Map(decisions.map((d) => [d.swimmer, d]));
        return json({
          ...dormant,
          swimmers: dormant.swimmers.map((s) => ({ ...s, decision: by.get(s.swimmer) ?? null })),
          // A decision only reaches the figures on the next pipeline run, and
          // saying so stops the board looking broken in the meantime.
          pending: decisions.filter((d) => d.decision === "active").length,
        });
      },

      POST: async ({ request }) => {
        const v = await viewer(request);
        if (!v) return json({ error: "Not signed in" }, 401);
        if (v.scope !== "coach") return json({ error: "Coordinators only" }, 403);

        const body = (await request.json()) as {
          swimmer?: string; decision?: string; reason?: string;
        };
        const swimmer = (body.swimmer ?? "").trim();
        const decision = (body.decision ?? "").trim();
        if (!swimmer) return json({ error: "Which swimmer?" }, 400);
        if (decision !== "active" && decision !== "dormant") {
          return json({ error: "decision must be active or dormant" }, 400);
        }
        // Only names the rule actually set aside, so a typo cannot invent a
        // swimmer or quietly reinstate someone the club confirmed had left.
        if (!dormant.swimmers.some((s) => s.swimmer === swimmer)) {
          return json({ error: "That swimmer is not on the dormant list" }, 400);
        }
        await q(
          `insert into public.roster_decisions (swimmer, decision, reason, decided_by)
           values ($1, $2, $3, $4)`,
          [swimmer, decision, (body.reason ?? "").trim() || null, v.email],
        );
        return json({ ok: true });
      },
    },
  },
});
