// RLS smoke-test for the swim tracker Supabase tables.
//
// Usage:
//   VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... bun run scripts/rls-probe.ts
// Or, if .env is populated:
//   bun --env-file=.env run scripts/rls-probe.ts
//
// What it does, in order:
//   1. anon SELECT on swimmers          (list roster)
//   2. anon SELECT on registrations     (list all)
//   3. anon SELECT on payments          (list all)
//   4. anon INSERT into swimmers        (temp row, then cleanup attempt)
//   5. anon INSERT into registrations   (linked to the temp swimmer)
//   6. anon INSERT into payments        (linked to the temp swimmer)
//
// Every step prints PASS / FAIL with the Supabase error code + message.
// Nothing crashes — every failure is captured and reported. Cleanup runs
// even after failures so we don't leave orphan rows if any step succeeded.

import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error(
    "Missing env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the shell or in .env.",
  );
  process.exit(2);
}

const sb = createClient(url, key);
const stamp = Date.now();
const probeSwimmerId = crypto.randomUUID();
const probeName = `__rls_probe_${stamp}__`;

type Step = {
  label: string;
  ok: boolean;
  detail: string;
};
const results: Step[] = [];

function record(label: string, ok: boolean, detail: string) {
  results.push({ label, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  —  ${detail}`);
}

function short(err: unknown): string {
  if (!err) return "(no error object)";
  const e = err as { code?: string; message?: string; details?: string; hint?: string };
  return [e.code && `code=${e.code}`, e.message, e.details, e.hint]
    .filter(Boolean)
    .join(" | ");
}

async function probeSelect(table: string) {
  const { error } = await sb.from(table).select("*").limit(1);
  if (error) record(`SELECT ${table}`, false, short(error));
  else record(`SELECT ${table}`, true, "returned without error");
}

async function probeInsertSwimmer() {
  const { error } = await sb
    .from("swimmers")
    .insert({ id: probeSwimmerId, name: probeName });
  if (error) record("INSERT swimmers", false, short(error));
  else record("INSERT swimmers", true, `inserted id=${probeSwimmerId}`);
}

async function probeInsertRegistration() {
  const { error } = await sb.from("registrations").insert({
    swimmer_id: probeSwimmerId,
    age: 10,
    gender: "Male",
    guardian_gender: "Male",
    parent_sleepover: "No",
    owns_cellphone: "No",
    parent1_name: probeName,
    primary_phone: "0700000000",
    updated_at: new Date().toISOString(),
  });
  if (error) record("INSERT registrations", false, short(error));
  else record("INSERT registrations", true, `inserted for swimmer=${probeSwimmerId}`);
}

async function probeInsertPayment() {
  const { error } = await sb.from("payments").insert({
    swimmer_id: probeSwimmerId,
    swimmer_ids: [probeSwimmerId],
    child_count: 1,
    amount: 1,
    reference: `RLSPROBE${stamp}`,
    type: "Deposit",
    created_at: new Date().toISOString(),
  });
  if (error) record("INSERT payments", false, short(error));
  else record("INSERT payments", true, `inserted for swimmer=${probeSwimmerId}`);
}

async function cleanup() {
  // Best-effort deletes — if RLS blocks delete, we log and move on.
  const p = await sb.from("payments").delete().eq("swimmer_id", probeSwimmerId);
  const r = await sb
    .from("registrations")
    .delete()
    .eq("swimmer_id", probeSwimmerId);
  const s = await sb.from("swimmers").delete().eq("id", probeSwimmerId);
  console.log(
    `\nCLEANUP  payments=${p.error ? "err:" + short(p.error) : "ok"}  ` +
      `registrations=${r.error ? "err:" + short(r.error) : "ok"}  ` +
      `swimmers=${s.error ? "err:" + short(s.error) : "ok"}`,
  );
}

async function main() {
  console.log(`Probing ${url}`);
  console.log(`Probe swimmer id: ${probeSwimmerId}\n`);

  await probeSelect("swimmers");
  await probeSelect("registrations");
  await probeSelect("payments");
  console.log();

  await probeInsertSwimmer();
  // Only try the FK-dependent inserts if the swimmer landed; otherwise the
  // registration/payment INSERTs would fail on foreign-key even under
  // permissive RLS, and we couldn't distinguish RLS vs FK.
  const swimmerOk = results.find((r) => r.label === "INSERT swimmers")?.ok;
  if (swimmerOk) {
    await probeInsertRegistration();
    await probeInsertPayment();
  } else {
    record(
      "INSERT registrations",
      false,
      "SKIPPED — swimmer INSERT failed so FK would confound the result",
    );
    record(
      "INSERT payments",
      false,
      "SKIPPED — swimmer INSERT failed so FK would confound the result",
    );
  }

  await cleanup();

  console.log("\n=== SUMMARY ===");
  const passes = results.filter((r) => r.ok).length;
  console.log(`${passes}/${results.length} passed`);
  const blocked = results.filter((r) => !r.ok);
  if (blocked.length) {
    console.log("\nBlocked steps (needs RLS policy):");
    blocked.forEach((r) => console.log(`  - ${r.label}: ${r.detail}`));
  }
  process.exit(blocked.length ? 1 : 0);
}

main().catch((err) => {
  console.error("Unhandled probe error:", err);
  process.exit(3);
});
