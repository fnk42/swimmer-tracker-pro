import Papa from "papaparse";
import { csvRowSchema } from "./schemas";
import type { CsvImportRow } from "./store";
import { getSwimmers, getRegistrations, getPayments } from "./store";
import { EVENT, formatKes } from "./event-config";

export type ParsedCsv = {
  valid: CsvImportRow[];
  invalid: { row: number; name: string; reason: string }[];
};

export function parseSwimmersCsv(text: string): ParsedCsv {
  const valid: CsvImportRow[] = [];
  const invalid: ParsedCsv["invalid"] = [];

  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  result.data.forEach((raw, i) => {
    const rowNum = i + 2; // header is row 1
    const parsed = csvRowSchema.safeParse({
      name: raw.name,
      age: raw.age,
      gender: raw.gender,
    });
    if (!parsed.success) {
      invalid.push({ row: rowNum, name: raw.name ?? "", reason: "Missing name" });
      return;
    }
    if (parsed.data.gender === "__invalid__") {
      invalid.push({
        row: rowNum,
        name: parsed.data.name,
        reason: `Invalid gender "${raw.gender}" (must be Male or Female)`,
      });
      return;
    }
    valid.push({
      name: parsed.data.name,
      age: parsed.data.age,
      gender: parsed.data.gender as "Male" | "Female" | undefined,
    });
  });

  return { valid, invalid };
}

export const CSV_TEMPLATE = `name,age,gender
Jane Doe,12,Female
John Doe,13,Male
`;

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Full export of all data for admin records.
export function exportAllData(): string {
  const swimmers = getSwimmers();
  const regs = getRegistrations();
  const payments = getPayments();

  const rows: string[] = [];
  rows.push(
    [
      "Swimmer",
      "Age",
      "Gender",
      "Sleepover",
      "Owns Phone",
      "Parent 1",
      "Parent 2",
      "Primary Phone",
      "Secondary Phone",
      "Dietary",
      "Allergies",
      "Health Conditions",
      "Special Requests",
      "Total (KES)",
      "Paid (KES)",
      "Balance (KES)",
      "Payment Date",
      "Payment Amount (KES)",
      "M-Pesa Ref",
      "Payment Type",
    ]
      .map(csvCell)
      .join(","),
  );

  swimmers.forEach((s) => {
    const r = regs[s.id];
    const paid = payments
      .filter((p) => p.swimmerId === s.id)
      .reduce((sum, p) => sum + p.amount, 0);
    const balance = Math.max(0, EVENT.totalKes - paid);
    const sPayments = payments.filter((p) => p.swimmerId === s.id);

    const base = [
      s.name,
      r?.age ?? s.age ?? "",
      r?.gender ?? s.gender ?? "",
      r?.sleepover ?? "",
      r?.ownsCellphone ?? "",
      r?.parent1Name ?? "",
      r?.parent2Name ?? "",
      r?.primaryPhone ?? "",
      r?.secondaryPhone ?? "",
      r?.dietary ?? "",
      r?.allergies ?? "",
      r?.healthConditions ?? "",
      r?.specialRequests ?? "",
      EVENT.totalKes,
      paid,
      balance,
    ];

    if (sPayments.length === 0) {
      rows.push([...base, "", "", "", ""].map(csvCell).join(","));
    } else {
      sPayments.forEach((p) => {
        rows.push(
          [...base, new Date(p.createdAt).toLocaleString(), p.amount, p.reference, p.type]
            .map(csvCell)
            .join(","),
        );
      });
    }
  });

  return rows.join("\n");
}

function csvCell(v: unknown): string {
  const s = v === undefined || v === null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// Re-export a helper for pretty labels used elsewhere
export { formatKes };
