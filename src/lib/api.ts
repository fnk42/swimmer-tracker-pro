import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Payment, Registration, Swimmer, Parent, SwimmerParentLink } from "./schemas";
import { EVENT } from "./event-config";
import { getSupabase } from "./supabase";
import { useParentSession } from "./auth";

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
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
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

// ---------- Parent-side "me" hooks (direct Supabase, RLS-scoped) --------
// These hooks bypass the anon-key TanStack API routes and call Supabase
// directly, so the signed-in parent's JWT flows through and RLS enforces
// row-level isolation. They MUST NOT be called from admin code (admin has
// no Supabase Auth session — the queries would return empty).

export function useMyParent() {
  const { user, loading } = useParentSession();
  const uid = user?.id ?? null;
  return useQuery({
    queryKey: ["me", "parent", uid],
    enabled: !loading && !!uid,
    queryFn: async (): Promise<Parent | null> => {
      if (!uid) return null;
      const { data, error } = await getSupabase()
        .from("parents")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();
      if (error) throw error;
      return data ? parentFromDb(data as ParentRow) : null;
    },
  });
}

export function useMyRegistrations() {
  const { session, loading } = useParentSession();
  return useQuery({
    queryKey: ["me", "registrations", session?.user.id ?? null],
    enabled: !loading && !!session,
    queryFn: async (): Promise<Registration[]> => {
      const { data, error } = await getSupabase().from("registrations").select("*");
      if (error) throw error;
      return (data ?? []).map((r) => regFromDb(r as RegistrationRow));
    },
  });
}

export function useMyPayments() {
  const { session, loading } = useParentSession();
  return useQuery({
    queryKey: ["me", "payments", session?.user.id ?? null],
    enabled: !loading && !!session,
    queryFn: async (): Promise<Payment[]> => {
      const { data, error } = await getSupabase().from("payments").select("*");
      if (error) throw error;
      return (data ?? []).map((p) => paymentFromDb(p as PaymentRow));
    },
  });
}

export function useMySwimmerParents() {
  const { session, loading } = useParentSession();
  return useQuery({
    queryKey: ["me", "swimmer-parents", session?.user.id ?? null],
    enabled: !loading && !!session,
    queryFn: async (): Promise<SwimmerParentLink[]> => {
      const { data, error } = await getSupabase().from("swimmer_parents").select("*");
      if (error) throw error;
      return (data ?? []).map((r) => {
        const row = r as SwimmerParentRow;
        return {
          swimmerId: row.swimmer_id,
          parentId: row.parent_id,
          sortOrder: row.sort_order,
        };
      });
    },
  });
}

// ---------- Parent-side "me" mutations ----------------------------------

type MyParentInput = {
  id?: string; // present → UPDATE; absent → INSERT
  fullName: string;
  gender?: "Male" | "Female" | null;
  phone: string;
  stayingOvernight: "Yes" | "No" | "Yet to decide";
  email?: string | null;
};

export function useSaveMyParent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: MyParentInput): Promise<Parent> => {
      const supabase = getSupabase();
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user.id;
      if (!uid) throw new Error("Not signed in.");
      const row = {
        full_name: input.fullName.trim(),
        gender: input.gender ?? null,
        phone: input.phone,
        staying_overnight: input.stayingOvernight,
        user_id: uid,
        email: input.email ?? sessionData.session?.user.email ?? null,
      };
      if (input.id) {
        const { data, error } = await supabase
          .from("parents")
          .update(row)
          .eq("id", input.id)
          .select()
          .single();
        if (error) throw error;
        return parentFromDb(data as ParentRow);
      }
      const { data, error } = await supabase.from("parents").insert([row]).select().single();
      if (error) throw error;
      return parentFromDb(data as ParentRow);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me", "parent"] });
      qc.invalidateQueries({ queryKey: ["parents"] });
    },
  });
}

export function useLinkMyParent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SwimmerParentLink): Promise<SwimmerParentLink> => {
      const supabase = getSupabase();
      // Idempotent: if my link already exists (e.g. a rehydrated returning
      // parent hitting Save again), skip the INSERT. Straight upserts fail
      // under our swimmer_parents RLS UPDATE-denies-authenticated policy.
      const { data: existing, error: selErr } = await supabase
        .from("swimmer_parents")
        .select("swimmer_id, parent_id, sort_order")
        .eq("swimmer_id", input.swimmerId)
        .eq("parent_id", input.parentId)
        .maybeSingle();
      if (selErr) throw selErr;
      if (existing) {
        const row = existing as SwimmerParentRow;
        return {
          swimmerId: row.swimmer_id,
          parentId: row.parent_id,
          sortOrder: row.sort_order,
        };
      }
      const { data, error } = await supabase
        .from("swimmer_parents")
        .insert([
          {
            swimmer_id: input.swimmerId,
            parent_id: input.parentId,
            sort_order: input.sortOrder,
          },
        ])
        .select()
        .single();
      if (error) throw error;
      const row = data as SwimmerParentRow;
      return {
        swimmerId: row.swimmer_id,
        parentId: row.parent_id,
        sortOrder: row.sort_order,
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me", "swimmer-parents"] });
      qc.invalidateQueries({ queryKey: ["swimmer-parents"] });
    },
  });
}

export function useSaveMyRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reg: Registration): Promise<Registration> => {
      const row = {
        swimmer_id: reg.swimmerId,
        age: reg.age,
        gender: reg.gender,
        guardian_gender: reg.guardianGender,
        parent_sleepover: reg.parentSleepover,
        owns_cellphone: reg.ownsCellphone,
        parent1_name: reg.parent1Name,
        parent2_name: reg.parent2Name || null,
        primary_phone: reg.primaryPhone,
        secondary_phone: reg.secondaryPhone || null,
        dietary: reg.dietary || null,
        allergies: reg.allergies || null,
        health_conditions: reg.healthConditions || null,
        special_requests: reg.specialRequests || null,
        updated_at: reg.updatedAt,
      };
      const { data, error } = await getSupabase()
        .from("registrations")
        .upsert([row], { onConflict: "swimmer_id" })
        .select()
        .single();
      if (error) throw error;
      return regFromDb(data as RegistrationRow);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me", "registrations"] });
      qc.invalidateQueries({ queryKey: ["registrations"] });
    },
  });
}

export function useAddMyPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<Payment, "id" | "createdAt">): Promise<Payment> => {
      const row = {
        swimmer_id: input.swimmerId,
        swimmer_ids: input.swimmerIds,
        child_count: input.childCount,
        amount: input.amount,
        reference: input.reference,
        type: input.type,
      };
      const { data, error } = await getSupabase().from("payments").insert([row]).select().single();
      if (error) throw error;
      return paymentFromDb(data as PaymentRow);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me", "payments"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
    },
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
