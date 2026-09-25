// Who is asking, and what that entitles them to.
//
// One place derives this, from the signed session plus the database — never
// from anything the browser sends. Every route that serves swimmer data calls
// viewer() and then obeys it.
import { q, one } from "@/lib/db";
import { sessionFromRequest } from "@/lib/session";
import type { Scope } from "@/lib/tiers";

/**
 * The tester row for this session, by id or — failing that — by address.
 *
 * A session is a snapshot of what was true when it was signed. Nyawira signed
 * in at 07:26 as a parent and was added to the preview at 15:52; her cookie
 * still said "parent and nothing else", so the agreement screen told her she
 * was not signed in as a tester and there was nothing she could do about it
 * from that screen. Anybody added to the preview after their last sign-in hits
 * this. The address is the same person, so look them up by it.
 */
export async function testerIdFor(
  s: { email: string; testerId?: string } | null,
): Promise<string | null> {
  if (!s) return null;
  if (s.testerId) return s.testerId;
  const row = await one<{ id: string }>(
    `select id from public.testers where lower(email) = lower($1)`,
    [s.email],
  );
  return row?.id ?? null;
}

/**
 * May this session see the analytics?
 *
 * Not yet a thing the club has released. Completing registration grants
 * `community`, which was opening the whole development picture — rankings,
 * bands, who is improving and who is not — to any parent who filled in a form,
 * while the preview existed precisely so the coaches read those judgements
 * first. So the page and the route behind it both ask this, and this asks for
 * a signed, unexpired preview invitation or a coordinator.
 *
 * When the analytics are released, this becomes a wider test and nothing else
 * has to move.
 */
export async function maySeeAnalytics(request: Request): Promise<boolean> {
  const s = sessionFromRequest(request);
  if (!s) return false;
  if (s.isAdmin) return true;
  const tid = await testerIdFor(s);
  if (!tid) return false;
  const row = await one<{ ok: boolean }>(
    `select (agreed_at is not null and revoked_at is null and expires_at > now()) as ok
       from public.testers where id = $1`,
    [tid],
  );
  return !!row?.ok;
}

// Re-exported so server routes keep importing entitlement facts from one place,
// while the constants themselves live in a module a client component can also
// import without pulling in the database driver.
export { CONSENT_VERSION, CONSENT_DOCUMENT } from "@/lib/consent-version";
import { CONSENT_VERSION, CONSENT_DOCUMENT } from "@/lib/consent-version";

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

  // Coaches and coordinators are recognised by the allowlist. They are NEVER
  // held at the registration gate, whether or not they also have a parent
  // record — and several do, because Boit and the other coordinators have
  // children who swim. Gating a coordinator behind a consent form they have
  // not seen yet would lock the club out of its own coordinator view, which is
  // exactly how the last lockout happened.
  //
  // Their own profile and consent are still tracked, so they can complete them
  // as a parent; it just never blocks the coach view.
  if (s.isAdmin) {
    const athletes = s.parentId
      ? await q<{ analytics_name: string }>(
          `select sw.analytics_name
             from public.swimmer_parents sp
             join public.swimmers sw on sw.id = sp.swimmer_id
            where sp.parent_id = $1 and sp.status = 'approved'
              and sw.analytics_name is not null`,
          [s.parentId],
        )
      : [];
    return {
      email: s.email,
      parentId: s.parentId ?? null,
      isAdmin: true,
      scope: "coach",
      needsProfile: false,
      needsConsent: false,
      myAthletes: athletes.map((r) => r.analytics_name),
      pendingClaims: 0,
    };
  }

  // An invited tester: no child, no Events, tier 1 only, and only while the
  // agreement is signed and the preview is still open. Checked here rather
  // than at the door so an expiry takes effect on the next request, not at
  // the next sign-in.
  if (s.testerId && !s.parentId) {
    const t = await one<{
      id: string;
      full_name: string;
      agreed_at: string | null;
      expired: boolean;
      revoked: boolean;
    }>(
      `select id, full_name, agreed_at,
              (expires_at < now())    as expired,
              (revoked_at is not null) as revoked
         from public.testers where id = $1`,
      [s.testerId],
    );
    if (!t || t.revoked || t.expired || !t.agreed_at) return null;
    void q(`update public.testers set last_seen_at = now() where id = $1`, [s.testerId]).catch(
      () => {},
    );
    return {
      email: s.email,
      parentId: null,
      isAdmin: false,
      scope: "tester",
      needsProfile: false,
      needsConsent: false,
      myAthletes: [],
      pendingClaims: 0,
    };
  }

  if (!s.parentId) return null;
  const pid = s.parentId;

  // The cookie is signed and self-contained, so it keeps working after the row
  // it names has been deleted — and the next write lands wherever the phone
  // number points, which is how a spare test account ended up writing into a
  // real family's record. If the account is gone, so is the session.
  const stillThere = await one<{ n: number }>(
    `select count(*)::int n from public.parents where id = $1`,
    [pid],
  );
  if ((stillThere?.n ?? 0) === 0) return null;

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
  // A guardian who has registered — name, phone and the current consent —
  // reaches the club's results whether or not a child is linked to them yet.
  //
  // Linking used to be the proof of belonging, and it is still what decides
  // whose ASSESSMENT you may read. But it was also gating the ordinary
  // results, which meant a parent could complete every step the club asked of
  // them and be shown an empty page until somebody matched them to a swimmer.
  // Registration is the thing to get right first; the link can follow.
  const registered =
    !!profile?.profile_complete && !!profile.full_name && !!profile.phone && (consent?.n ?? 0) > 0;
  const approved = myAthletes.length > 0 || registered;

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
