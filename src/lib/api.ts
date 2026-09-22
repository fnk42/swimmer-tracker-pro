import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Payment, Registration, Swimmer, Parent, SwimmerParentLink } from "./schemas";
import { EVENT } from "./event-config";

// ---------- Wire (snake_case) types --------------------------------------
type SwimmerRow = {
  id: string;
  name: string;
  age?: number;
  gender?: "Male" | "Female";
  created_at: string;
};

type RegistrationRow = {
  swimmer_id: string;
  age: number;
  gender: "Male" | "Female";
  guardian_gender: "Male" | "Female";
  parent_sleepover: "Yes" | "No" | "Yet to decide";
  owns_cellphone: "Yes" | "No";
  parent1_name: string;
  parent2_name?: string | null;
  primary_phone: string;
  secondary_phone?: string | null;
  dietary?: string | null;
  allergies?: string | null;
  health_conditions?: string | null;
  special_requests?: string | null;
  updated_at: string;
};

type PaymentRow = {
  id: string;
  swimmer_id: string;
  swimmer_ids: string[];
  child_count: number;
  amount: number;
  reference: string;
  type: "Deposit" | "Partial" | "Final";
  created_at: string;
};

type ParentRow = {
  id: string;
  full_name: string;
  gender: "Male" | "Female" | null;
  phone: string;
  staying_overnight: "Yes" | "No" | "Yet to decide";
  user_id: string | null;
  email: string | null;
  backfill_note: string | null;
  created_at: string;
  updated_at: string;
};

type SwimmerParentRow = {
  swimmer_id: string;
  parent_id: string;
  sort_order: number;
};

// ---------- Mappers ------------------------------------------------------
function swimmerFromDb(s: SwimmerRow): Swimmer {
  return { id: s.id, name: s.name, age: s.age, gender: s.gender };
}

function regFromDb(r: RegistrationRow): Registration {
  return {
    swimmerId: r.swimmer_id,
    age: r.age,
    gender: r.gender,
    guardianGender: r.guardian_gender,
    parentSleepover: r.parent_sleepover,
    ownsCellphone: r.owns_cellphone,
    parent1Name: r.parent1_name,
    parent2Name: r.parent2_name ?? "",
    primaryPhone: r.primary_phone,
    secondaryPhone: r.secondary_phone ?? "",
    dietary: r.dietary ?? "",
    allergies: r.allergies ?? "",
    healthConditions: r.health_conditions ?? "",
    specialRequests: r.special_requests ?? "",
    updatedAt: r.updated_at,
  };
}

function paymentFromDb(p: PaymentRow): Payment {
  return {
    id: p.id,
    swimmerId: p.swimmer_id,
    swimmerIds: p.swimmer_ids && p.swimmer_ids.length > 0 ? p.swimmer_ids : [p.swimmer_id],
    childCount: p.child_count && p.child_count > 0 ? p.child_count : 1,
    amount: p.amount,
    reference: p.reference,
    type: p.type,
    createdAt: p.created_at,
  };
}

function parentFromDb(p: ParentRow): Parent {
  return {
    id: p.id,
    fullName: p.full_name,
    gender: p.gender ?? undefined,
    phone: p.phone,
    stayingOvernight: p.staying_overnight,
    userId: p.user_id ?? undefined,
    email: p.email ?? undefined,
    backfillNote: p.backfill_note ?? undefined,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    // Our routes answer with { error: "a sentence for the person reading it" }.
    // Use that sentence. Dumping the raw body put things like
    //   409 : {"error":"That swimmer is already registered..."}
    // in front of parents, which is noise wrapped around the useful part.
    const text = await res.text().catch(() => "");
    let message = "";
    try {
      const body = JSON.parse(text) as { error?: string };
      if (typeof body?.error === "string") message = body.error;
    } catch {
      /* not JSON — fall through */
    }
    if (!message) {
      message =
        res.status === 401
          ? "Your session has expired. Please sign in again."
          : res.status === 403
            ? "You do not have access to that."
            : res.status >= 500
              ? "Something went wrong at our end. Please try again."
              : "That didn't work. Please try again.";
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

// ---------- Queries ------------------------------------------------------
export function useSwimmers() {
  return useQuery({
    queryKey: ["swimmers"],
    queryFn: async () => {
      const rows = await apiFetch<SwimmerRow[]>("/api/swimmers");
      return rows.map(swimmerFromDb);
    },
  });
}

export function useRegistrations() {
  return useQuery({
    queryKey: ["registrations"],
    queryFn: async () => {
      const rows = await apiFetch<RegistrationRow[]>("/api/registrations");
      return rows.map(regFromDb);
    },
  });
}

export function usePayments() {
  return useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const rows = await apiFetch<PaymentRow[]>("/api/payments");
      return rows.map(paymentFromDb);
    },
  });
}

export function useParents() {
  return useQuery({
    queryKey: ["parents"],
    queryFn: async () => {
      const rows = await apiFetch<ParentRow[]>("/api/parents");
      return rows.map(parentFromDb);
    },
  });
}

export function useSwimmerParents() {
  return useQuery({
    queryKey: ["swimmer-parents"],
    queryFn: async (): Promise<SwimmerParentLink[]> => {
      const rows = await apiFetch<SwimmerParentRow[]>("/api/swimmer-parents");
      return rows.map((r) => ({
        swimmerId: r.swimmer_id,
        parentId: r.parent_id,
        sortOrder: r.sort_order,
      }));
    },
  });
}

// ---------- Mutations ----------------------------------------------------
export function useSaveRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reg: Registration) => {
      const row = await apiFetch<RegistrationRow>("/api/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(reg),
      });
      return regFromDb(row);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["registrations"] });
    },
  });
}

export function useAddPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<Payment, "id" | "createdAt">) => {
      const row = await apiFetch<PaymentRow>("/api/payment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      return paymentFromDb(row);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
    },
  });
}

export function useSaveParent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<Parent, "id" | "createdAt" | "updatedAt">) => {
      const row = await apiFetch<ParentRow>("/api/parents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      return parentFromDb(row);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parents"] });
    },
  });
}

export function useLinkParent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SwimmerParentLink) => {
      const row = await apiFetch<SwimmerParentRow>("/api/parents/link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      return {
        swimmerId: row.swimmer_id,
        parentId: row.parent_id,
        sortOrder: row.sort_order,
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["swimmer-parents"] });
      qc.invalidateQueries({ queryKey: ["parents"] });
    },
  });
}

export function useAddSwimmer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; age?: number; gender?: "Male" | "Female" }) => {
      const row = await apiFetch<SwimmerRow>("/api/swimmers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      return swimmerFromDb(row);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["swimmers"] }),
  });
}

export function useImportSwimmers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: Array<{ name: string; age?: number; gender?: "Male" | "Female" }>) => {
      const result = await apiFetch<{
        imported: SwimmerRow[];
        skipped: Array<{ name: string; reason: string }>;
      }>("/api/swimmers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(rows),
      });
      return {
        imported: result.imported.map(swimmerFromDb),
        skipped: result.skipped,
      };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["swimmers"] }),
  });
}

export function useRenameSwimmer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const row = await apiFetch<SwimmerRow>(`/api/swimmers/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      return swimmerFromDb(row);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["swimmers"] }),
  });
}

export function useDeleteSwimmer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch<{ ok: true }>(`/api/swimmers/${id}`, { method: "DELETE" });
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["swimmers"] });
      qc.invalidateQueries({ queryKey: ["registrations"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
    },
  });
}

// ---------- Parent-side "me" hooks --------------------------------------
// These used to query Supabase straight from the browser, relying on RLS to
// keep one family out of another's data. They now go through /api/me/*, where
// the parent id comes from the signed session cookie rather than from anything
// the caller sends — so there is no parameter in which to ask for someone
// else's child, and the browser holds no database credential at all.

export type Me = {
  signedIn: boolean;
  email?: string;
  isAdmin?: boolean;
  sections?: { performance: boolean; events: boolean };
  scope?: "coach" | "community" | "pending";
  needsRegistration?: boolean;
  /** Account opened by signing in, never filled in. Greet them as new. */
  firstTime?: boolean;
  needsProfile?: boolean;
  needsConsent?: boolean;
  pendingClaims?: number;
  myAthletes?: number;
  parent: Parent | null;
};

type MeDataWire = {
  parent: ParentRow | null;
  swimmers: SwimmerRow[];
  links: SwimmerParentRow[];
  registrations: RegistrationRow[];
  payments: PaymentRow[];
};

/** Who is signed in. Cheap, and safe to call anywhere. */
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async (): Promise<Me> => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) return { signedIn: false, parent: null };
      const d = await res.json();
      return {
        signedIn: !!d.signedIn,
        email: d.email,
        isAdmin: !!d.isAdmin,
        sections: d.sections ?? { performance: true, events: true },
        scope: d.scope,
        needsRegistration: !!d.needsRegistration,
        firstTime: !!d.firstTime,
        needsProfile: !!d.needsProfile,
        needsConsent: !!d.needsConsent,
        pendingClaims: d.pendingClaims ?? 0,
        myAthletes: d.myAthletes ?? 0,
        parent: d.parent
          ? {
              id: d.parent.id,
              fullName: d.parent.fullName,
              phone: d.parent.phone,
              email: d.parent.email,
              stayingOvernight: "Yet to decide",
              createdAt: "",
              updatedAt: "",
            }
          : null,
      };
    },
    staleTime: 30_000,
  });
}

/** Everything this parent may see, in one request. */
function useMyData() {
  return useQuery({
    queryKey: ["me", "data"],
    queryFn: async (): Promise<MeDataWire> => {
      const res = await fetch("/api/me/data");
      if (res.status === 401) {
        return { parent: null, swimmers: [], links: [], registrations: [], payments: [] };
      }
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as MeDataWire;
    },
  });
}

export function useMyParent() {
  const qy = useMyData();
  return { ...qy, data: qy.data?.parent ? parentFromDb(qy.data.parent) : null };
}

export function useMySwimmers() {
  const qy = useMyData();
  return { ...qy, data: (qy.data?.swimmers ?? []).map(swimmerFromDb) };
}

export function useMyRegistrations() {
  const qy = useMyData();
  return { ...qy, data: (qy.data?.registrations ?? []).map(regFromDb) };
}

export function useMyPayments() {
  const qy = useMyData();
  return { ...qy, data: (qy.data?.payments ?? []).map(paymentFromDb) };
}

export function useMySwimmerParents() {
  const qy = useMyData();
  return {
    ...qy,
    data: (qy.data?.links ?? []).map((l) => ({
      swimmerId: l.swimmer_id,
      parentId: l.parent_id,
      sortOrder: l.sort_order,
    })),
  };
}

// ---------- Parent-side "me" mutations ----------------------------------

type MyParentInput = {
  id?: string;
  fullName: string;
  gender?: "Male" | "Female" | null;
  phone: string;
  stayingOvernight: "Yes" | "No" | "Yet to decide";
  email?: string | null;
};

/** Invalidate everything the parent view reads. */
function useRefreshMe() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["me"] });
  };
}

export function useSaveMyParent() {
  const refresh = useRefreshMe();
  return useMutation({
    mutationFn: async (input: MyParentInput): Promise<Parent> => {
      const row = await apiFetch<ParentRow>("/api/me/parent", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      return parentFromDb(row);
    },
    onSuccess: refresh,
  });
}

export function useLinkMyParent() {
  const refresh = useRefreshMe();
  return useMutation({
    mutationFn: async (input: { swimmerId: string }): Promise<SwimmerParentLink> => {
      const row = await apiFetch<SwimmerParentRow>("/api/me/link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ swimmerId: input.swimmerId }),
      });
      return { swimmerId: row.swimmer_id, parentId: row.parent_id, sortOrder: row.sort_order };
    },
    onSuccess: refresh,
  });
}

export function useSaveMyRegistration() {
  const refresh = useRefreshMe();
  return useMutation({
    mutationFn: async (input: Registration): Promise<Registration> => {
      const row = await apiFetch<RegistrationRow>("/api/me/registration", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      return regFromDb(row);
    },
    onSuccess: refresh,
  });
}

export function useAddMyPayment() {
  const refresh = useRefreshMe();
  return useMutation({
    mutationFn: async (input: {
      swimmerId: string;
      swimmerIds?: string[];
      childCount?: number;
      amount: number;
      reference: string;
      type?: "Deposit" | "Partial" | "Final";
    }): Promise<Payment> => {
      const row = await apiFetch<PaymentRow>("/api/me/payment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      return paymentFromDb(row);
    },
    onSuccess: refresh,
  });
}

// ---------- Sign in / out ------------------------------------------------

export function useRequestCode() {
  return useMutation({
    mutationFn: async (email: string): Promise<{ ok: boolean; devMode?: boolean }> =>
      apiFetch("/api/auth/request-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      }),
  });
}

export function useVerifyCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; code: string }) =>
      apiFetch<{ ok: boolean; isAdmin: boolean; parent: { id: string; fullName: string } | null }>(
        "/api/auth/verify-code",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
      ),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export type ClaimableSwimmer = {
  id: string;
  name: string;
  adults: number;
  mine: boolean;
  slotsLeft: number;
};

/** Search the roster for a swimmer to claim. Searched, never browsed — the
 *  endpoint wants at least two characters and returns at most eight. */
export function useClaimable(term: string) {
  const q = term.trim();
  return useQuery({
    queryKey: ["claimable", q],
    enabled: q.length >= 2,
    queryFn: () =>
      apiFetch<{ swimmers: ClaimableSwimmer[] }>(
        `/api/me/claimable?q=${encodeURIComponent(q)}`,
      ).then((r) => r.swimmers ?? []),
  });
}

/** Put myself on a swimmer's record. Up to two adults may hold the same child. */
export function useClaimSwimmer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (swimmerId: string) =>
      apiFetch("/api/me/link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ swimmerId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["claimable"] });
    },
  });
}

/** Take myself off a child's record. Only ever removes my own link. */
export function useUnlinkSwimmer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (swimmerId: string) =>
      apiFetch<{ ok: boolean; name: string }>("/api/me/link", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ swimmerId }),
      }),
    onSuccess: () => {
      // ["me"] is a prefix of ["me","data"], so this refreshes the account
      // and the swimmer list behind it in one go.
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["claimable"] });
    },
  });
}

export function useSignOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await fetch("/api/auth/me", { method: "DELETE" });
    },
    onSuccess: () => qc.clear(),
  });
}
// ---------- Derived helpers (pure) --------------------------------------
// A multi-child payment credits amount/childCount to each covered swimmer —
// same rule the admin status endpoint uses.
function coveredIds(p: Payment): string[] {
  return p.swimmerIds && p.swimmerIds.length > 0 ? p.swimmerIds : [p.swimmerId];
}
function countFor(p: Payment): number {
  return p.childCount && p.childCount > 0 ? p.childCount : 1;
}

export function paymentsForSwimmer(all: Payment[], swimmerId: string): Payment[] {
  return all
    .filter((p) => coveredIds(p).includes(swimmerId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function parentsForSwimmer(
  allLinks: SwimmerParentLink[],
  allParents: Parent[],
  swimmerId: string,
): Parent[] {
  const byId = new Map(allParents.map((p) => [p.id, p]));
  return allLinks
    .filter((l) => l.swimmerId === swimmerId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((l) => byId.get(l.parentId))
    .filter((p): p is Parent => !!p);
}

export function paidForSwimmer(all: Payment[], swimmerId: string): number {
  return all.reduce((sum, p) => {
    if (!coveredIds(p).includes(swimmerId)) return sum;
    return sum + p.amount / countFor(p);
  }, 0);
}

export function balanceForSwimmer(all: Payment[], swimmerId: string): number {
  return Math.max(0, EVENT.totalKes - paidForSwimmer(all, swimmerId));
}

export function statusForSwimmer(all: Payment[], swimmerId: string): "Unpaid" | "Partial" | "Paid" {
  const paid = paidForSwimmer(all, swimmerId);
  if (paid <= 0) return "Unpaid";
  if (paid >= EVENT.totalKes) return "Paid";
  return "Partial";
}
