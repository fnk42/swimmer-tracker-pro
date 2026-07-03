import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// This template uses Vite (via @lovable.dev/vite-tanstack-config), which loads
// only VITE_* prefixed env vars and inlines them as import.meta.env.VITE_* at
// build time. NEXT_PUBLIC_* is a Next.js convention and is NOT injected here.
// We also fall back to process.env at runtime (for Node server functions) and
// accept unprefixed / NEXT_PUBLIC_ names so old configs still work.
function readEnv(name: string): string | undefined {
  const meta = (import.meta as { env?: Record<string, string | undefined> }).env;
  if (meta && meta[name]) return meta[name];
  if (typeof process !== "undefined" && process.env && process.env[name]) {
    return process.env[name];
  }
  return undefined;
}

const SUPABASE_URL =
  readEnv("VITE_SUPABASE_URL") ||
  readEnv("SUPABASE_URL") ||
  readEnv("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_ANON_KEY =
  readEnv("VITE_SUPABASE_ANON_KEY") ||
  readEnv("SUPABASE_ANON_KEY") ||
  readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

let cachedClient: SupabaseClient | null = null;

// Lazy — never throws at module import time. The first call inside a request
// handler either returns a cached client or throws a clear error that the
// handler can convert into a 500 JSON response.
export function getSupabase(): SupabaseClient {
  if (cachedClient) return cachedClient;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    const missing = [
      !SUPABASE_URL && "VITE_SUPABASE_URL",
      !SUPABASE_ANON_KEY && "VITE_SUPABASE_ANON_KEY",
    ]
      .filter(Boolean)
      .join(", ");
    const msg = `Supabase env vars missing: ${missing}. Set them in Vercel (Preview + Production) and in your local .env.`;
    console.error("[supabase] " + msg);
    throw new Error(msg);
  }
  cachedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return cachedClient;
}

export function hasSupabaseConfig(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export type Swimmer = {
  id: string;
  name: string;
  age?: number;
  gender?: "Male" | "Female";
  created_at: string;
};

export type Registration = {
  swimmer_id: string;
  age: number;
  gender: "Male" | "Female";
  guardian_gender: "Male" | "Female";
  parent_sleepover: "Yes" | "No" | "Yet to decide";
  owns_cellphone: "Yes" | "No";
  parent1_name: string;
  parent2_name?: string;
  primary_phone: string;
  secondary_phone?: string;
  dietary?: string;
  allergies?: string;
  health_conditions?: string;
  special_requests?: string;
  updated_at: string;
};

export type Payment = {
  id: string;
  swimmer_id: string;
  swimmer_ids: string[];
  child_count: number;
  amount: number;
  reference: string;
  type: "Deposit" | "Partial" | "Final";
  created_at: string;
};
