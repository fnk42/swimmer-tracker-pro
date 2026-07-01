// Typed localStorage helpers for the NextGen MVP.
// All persistence is client-side; swap for Supabase later.

import { SEED_SWIMMERS, EVENT } from "./event-config";
import type { Swimmer, Registration, Payment } from "./schemas";

const KEYS = {
  authed: "ng_authed",
  swimmers: "ng_swimmers",
  registrations: "ng_registrations",
  payments: "ng_payments",
  seeded: "ng_seeded",
} as const;

function isBrowser() {
  return typeof window !== "undefined";
}

function read<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function uid(): string {
  if (isBrowser() && "randomUUID" in crypto) return crypto.randomUUID();
  return "id_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// --- Auth ---------------------------------------------------------------
export function isAuthed(): boolean {
  return isBrowser() && window.localStorage.getItem(KEYS.authed) === "true";
}
export function setAuthed(v: boolean) {
  if (!isBrowser()) return;
  if (v) window.localStorage.setItem(KEYS.authed, "true");
  else window.localStorage.removeItem(KEYS.authed);
}

// --- Swimmers -----------------------------------------------------------
export function getSwimmers(): Swimmer[] {
  ensureSeeded();
  return read<Swimmer[]>(KEYS.swimmers, []);
}

function ensureSeeded() {
  if (!isBrowser()) return;
  if (window.localStorage.getItem(KEYS.seeded) === "true") return;
  const seeded: Swimmer[] = SEED_SWIMMERS.map((s) => ({ id: uid(), ...s }));
  write(KEYS.swimmers, seeded);
  window.localStorage.setItem(KEYS.seeded, "true");
}

export function setSwimmers(list: Swimmer[]) {
  write(KEYS.swimmers, list);
}

export function addSwimmer(input: Omit<Swimmer, "id">): Swimmer {
  const swimmers = getSwimmers();
  const swimmer: Swimmer = { id: uid(), ...input };
  setSwimmers([...swimmers, swimmer]);
  return swimmer;
}

export function renameSwimmer(id: string, name: string) {
  setSwimmers(getSwimmers().map((s) => (s.id === id ? { ...s, name } : s)));
}

export function removeSwimmer(id: string) {
  setSwimmers(getSwimmers().filter((s) => s.id !== id));
  const regs = getRegistrations();
  delete regs[id];
  write(KEYS.registrations, regs);
  setPayments(getPayments().filter((p) => p.swimmerId !== id));
}

export function findSwimmerByName(name: string): Swimmer | undefined {
  const n = name.trim().toLowerCase();
  return getSwimmers().find((s) => s.name.trim().toLowerCase() === n);
}

export type CsvImportRow = { name: string; age?: number; gender?: "Male" | "Female" };
export type CsvImportResult = {
  imported: Swimmer[];
  skipped: { row: number; name: string; reason: string }[];
};

export function importSwimmers(rows: CsvImportRow[]): CsvImportResult {
  const result: CsvImportResult = { imported: [], skipped: [] };
  const current = getSwimmers();
  const seen = new Set(current.map((s) => s.name.trim().toLowerCase()));
  const next = [...current];
  rows.forEach((r, i) => {
    const key = r.name.trim().toLowerCase();
    if (!key) {
      result.skipped.push({ row: i + 2, name: r.name || "(blank)", reason: "Missing name" });
      return;
    }
    if (seen.has(key)) {
      result.skipped.push({ row: i + 2, name: r.name, reason: "Duplicate — already in roster" });
      return;
    }
    const swimmer: Swimmer = { id: uid(), name: r.name.trim(), age: r.age, gender: r.gender };
    next.push(swimmer);
    seen.add(key);
    result.imported.push(swimmer);
  });
  setSwimmers(next);
  return result;
}

// --- Registrations ------------------------------------------------------
export function getRegistrations(): Record<string, Registration> {
  return read<Record<string, Registration>>(KEYS.registrations, {});
}

export function getRegistration(id: string): Registration | undefined {
  return getRegistrations()[id];
}

export function saveRegistration(reg: Registration) {
  const all = getRegistrations();
  all[reg.swimmerId] = reg;
  write(KEYS.registrations, all);
}

export function isRegistered(id: string): boolean {
  return !!getRegistrations()[id];
}

// --- Payments -----------------------------------------------------------
export function getPayments(): Payment[] {
  return read<Payment[]>(KEYS.payments, []);
}

export function setPayments(list: Payment[]) {
  write(KEYS.payments, list);
}

export function getPaymentsFor(swimmerId: string): Payment[] {
  return getPayments()
    .filter((p) => p.swimmerId === swimmerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function addPayment(input: Omit<Payment, "id" | "createdAt">): Payment {
  const payment: Payment = { id: uid(), createdAt: new Date().toISOString(), ...input };
  setPayments([...getPayments(), payment]);
  return payment;
}

export function getPaid(swimmerId: string): number {
  return getPayments()
    .filter((p) => p.swimmerId === swimmerId)
    .reduce((sum, p) => sum + p.amount, 0);
}

export function getBalance(swimmerId: string): number {
  return Math.max(0, EVENT.totalKes - getPaid(swimmerId));
}

export function getStatus(swimmerId: string): "Unpaid" | "Partial" | "Paid" {
  const paid = getPaid(swimmerId);
  if (paid <= 0) return "Unpaid";
  if (paid >= EVENT.totalKes) return "Paid";
  return "Partial";
}
