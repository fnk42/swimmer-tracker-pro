// Who is asking, and what that entitles them to.
//
// One place derives this, from the signed session plus the database — never
// from anything the browser sends. Every route that serves swimmer data calls
// viewer() and then obeys it.
import { q, one } from "@/lib/db";
import { sessionFromRequest } from "@/lib/session";
import type { Scope } from "@/lib/tiers";

// Bump when the consent text changes. Guardians who accepted an older version
// are asked to accept the new one before they reach the dashboard.
export const CONSENT_VERSION = "2026-09-17";
export const CONSENT_DOCUMENT = "guardian_data_consent";

export type Viewer = {
  email: string;
  parentId: string | null;
  isAdmin: boolean;
  /** What shape of analytics this person may receive. */
  scope: Scope;
  /** Registration is not finished until both of these are false. */
  needsProfile: boolean;
  needsConsent: boolean;
  /** Archive keys of children this viewer is an APPROVED guardian of. */
  myAthletes: string[];
  /** Claims still waiting on a coordinator. */
  pendingClaims: number;
};

/**
 * Entitlement for the current request, or null if not signed in.
 *
 * The community tier is deliberately gated on an APPROVED link, not on merely
 * having signed up. Someone can create an account and claim a child in under a
 * minute; until a coordinator or a record match confirms that claim, they see
 * the club's aggregate numbers and not one child's name.
 */
export async function viewer(request: Request): Promise<Viewer | null> {
  const s = sessionFromRequest(request);
  if (!s) return null;

  // Coaches and coordinators are recognised by the allowlist, so they need no
  // parent record and no claim.
  if (s.isAdmin && !s.parentId) {
    return {
      email: s.email,
      parentId: null,
      isAdmin: true,
      scope: "coach",
      needsProfile: false,
      needsConsent: false,
      myAthletes: [],
      pendingClaims: 0,
    };
  }

  if (!s.parentId) return null;
  const pid = s.parentId;

  const [profile, consent, mine, pending] = await Promise.all([
    one<{ profile_complete: boolean; full_name: string; phone: string }>(
      `select profile_complete, coalesce(full_name,'') as full_name,
              coalesce(phone,'') as phone
         from public.parents where id = $1`,
      [pid],
    ),
    one<{ n: number }>(
      `select count(*)::int n from public.consents
        where parent_id = $1 and document = $2 and version = $3
          and withdrawn_at is null`,
      [pid, CONSENT_DOCUMENT, CONSENT_VERSION],
    ),
    q<{ analytics_name: string }>(
      `select sw.analytics_name
         from public.swimmer_parents sp
         join public.swimmers sw on sw.id = sp.swimmer_id
        where sp.parent_id = $1 and sp.status = 'approved'
          and sw.analytics_name is not null`,
      [pid],
    ),
    one<{ n: number }>(
      `select count(*)::int n from public.swimmer_parents
        where parent_id = $1 and status = 'pending'`,
      [pid],
    ),
  ]);

  const myAthletes = mine.map((r) => r.analytics_name);
  const approved = myAthletes.length > 0;

  return {
    email: s.email,
    parentId: pid,
    isAdmin: !!s.isAdmin,
    scope: s.isAdmin ? "coach" : approved ? "community" : "pending",
    needsProfile: !profile?.profile_complete || !profile.full_name || !profile.phone,
    needsConsent: (consent?.n ?? 0) === 0,
    myAthletes,
    pendingClaims: pending?.n ?? 0,
  };
}

/**
 * May this viewer see the assessment for one particular athlete?
 *
 * Coaches may see anyone's. A guardian may see only their own children's, and
 * only once the claim has been approved — which is the whole point of the claim
 * having a status.
 */
export function maySeeAssessment(v: Viewer, analyticsName: string): boolean {
  if (v.isAdmin) return true;
  return v.myAthletes.includes(analyticsName);
}
