import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Payment, Registration, Swimmer } from "./schemas";
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

export function useAddSwimmer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      age?: number;
      gender?: "Male" | "Female";
    }) => {
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
    mutationFn: async (
      rows: Array<{ name: string; age?: number; gender?: "Male" | "Female" }>,
    ) => {
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

export function paidForSwimmer(all: Payment[], swimmerId: string): number {
  return all.reduce((sum, p) => {
    if (!coveredIds(p).includes(swimmerId)) return sum;
    return sum + p.amount / countFor(p);
  }, 0);
}

export function balanceForSwimmer(all: Payment[], swimmerId: string): number {
  return Math.max(0, EVENT.totalKes - paidForSwimmer(all, swimmerId));
}

export function statusForSwimmer(
  all: Payment[],
  swimmerId: string,
): "Unpaid" | "Partial" | "Paid" {
  const paid = paidForSwimmer(all, swimmerId);
  if (paid <= 0) return "Unpaid";
  if (paid >= EVENT.totalKes) return "Paid";
  return "Partial";
}
