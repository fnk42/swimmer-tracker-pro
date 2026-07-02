import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseKey);

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
