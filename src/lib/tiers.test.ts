// The test that makes src/lib/tiers.ts binding rather than advisory.
//
// Run: bun test
//
// The first test is the important one. It walks the real analytics output and
// fails if any field is not classified in the manifest. Add a metric to
// NextGen/tools/analytics.py and forget to decide what tier it belongs to, and
// this breaks — instead of the field quietly reaching every parent in the club.
import { describe, expect, test } from "bun:test";
import data from "../tracker/data.json";
import {
  EVENT_FIELDS,
  SWIMMER_FIELDS,
  TOP_LEVEL,
  YEAR_BLOCKS,
  assessmentFor,
  shapeAnalytics,
} from "./tiers";

type Rec = Record<string, unknown>;
const D = data as unknown as Rec;
const all = (D.years as Record<string, Rec>).all;
const swimmers = all.swimmers as Rec[];

const classifiedSwimmer = new Set<string>([
  ...SWIMMER_FIELDS.tier1,
  ...SWIMMER_FIELDS.tier2,
  ...SWIMMER_FIELDS.coach,
]);
const classifiedBlocks = new Set<string>([
  ...YEAR_BLOCKS.tier1,
  ...YEAR_BLOCKS.coach,
  "swimmers",
]);

describe("every analytics field is classified", () => {
  test("swimmer record has no unclassified field", () => {
    const seen = new Set<string>();
    for (const s of swimmers) for (const k of Object.keys(s)) seen.add(k);
    const unknown = [...seen].filter((k) => !classifiedSwimmer.has(k));
    expect(unknown).toEqual([]);
  });

  test("event record has no unclassified field", () => {
    const seen = new Set<string>();
    for (const s of swimmers) {
      for (const e of (s.events as Rec[]) ?? []) for (const k of Object.keys(e)) seen.add(k);
    }
    const unknown = [...seen].filter((k) => !(EVENT_FIELDS as readonly string[]).includes(k));
    expect(unknown).toEqual([]);
  });

  test("year block has no unclassified section", () => {
    const seen = new Set<string>();
    for (const block of Object.values(D.years as Record<string, Rec>)) {
      for (const k of Object.keys(block)) seen.add(k);
    }
    const unknown = [...seen].filter((k) => !classifiedBlocks.has(k));
    expect(unknown).toEqual([]);
  });

  test("top-level block has no unclassified section", () => {
    const unknown = Object.keys(D).filter(
      (k) => !(TOP_LEVEL.tier1 as readonly string[]).includes(k),
    );
    expect(unknown).toEqual([]);
  });

  test("an unclassified top-level block never reaches a viewer", () => {
    const withLeak = { ...D, secretRoster: [{ name: "Child", note: "private" }] };
    for (const scope of ["community", "pending"] as const) {
      expect(Object.keys(shapeAnalytics(withLeak, scope))).not.toContain("secretRoster");
    }
  });

  test("bandSeasons names nobody", () => {
    const json = JSON.stringify((D as Rec).bandSeasons);
    for (const s of swimmers.slice(0, 40)) {
      expect(json).not.toContain(s.name as string);
    }
  });

  test("no field is in two tiers at once", () => {
    const t1 = new Set<string>(SWIMMER_FIELDS.tier1);
    const overlap = [...SWIMMER_FIELDS.tier2, ...SWIMMER_FIELDS.coach].filter((k) => t1.has(k));
    expect(overlap).toEqual([]);
  });
});

describe("community scope: names yes, assessment no", () => {
  const shaped = shapeAnalytics(D, "community");
  const shapedSwimmers = (shaped.years as Record<string, Rec>).all.swimmers as Rec[];

  test("keeps every swimmer", () => {
    expect(shapedSwimmers.length).toBe(swimmers.length);
    expect(shapedSwimmers.length).toBeGreaterThan(100);
  });

  test("keeps the competition record", () => {
    const s = shapedSwimmers[0];
    expect(typeof s.name).toBe("string");
    for (const f of ["age", "swims", "pbs", "podiums", "trend"]) {
      expect(s[f]).toBeDefined();
    }
  });

  test("carries no assessment field on any swimmer", () => {
    const leaked = new Set<string>();
    for (const s of shapedSwimmers) {
      for (const f of [...SWIMMER_FIELDS.tier2, ...SWIMMER_FIELDS.coach]) {
        if (f in s) leaked.add(f);
      }
    }
    expect([...leaked]).toEqual([]);
  });

  test("carries no coach-only block", () => {
    for (const block of Object.values(shaped.years as Record<string, Rec>)) {
      expect(block.watch).toEqual({});
    }
  });

  test("the word review never appears as a label", () => {
    // Cheap belt-and-braces: the serialised community payload should not
    // contain a swimmer classification at all.
    const json = JSON.stringify(shapedSwimmers);
    expect(json).not.toContain('"cls"');
    expect(json).not.toContain('"focus"');
    expect(json).not.toContain('"consBand"');
  });
});

describe("pending scope: no child is named", () => {
  const shaped = shapeAnalytics(D, "pending");

  test("swimmer list is empty in every season", () => {
    for (const block of Object.values(shaped.years as Record<string, Rec>)) {
      expect(block.swimmers).toEqual([]);
    }
  });

  test("club aggregates survive", () => {
    const a = (shaped.years as Record<string, Rec>).all;
    expect(a.summary).toBeDefined();
    expect(a.ages).toBeDefined();
    expect(a.comps).toBeDefined();
  });

  test("no swimmer name appears anywhere in the payload", () => {
    const json = JSON.stringify(shaped);
    // every real swimmer name from the archive
    const hits = swimmers.map((s) => s.name as string).filter((n) => json.includes(n));
    expect(hits).toEqual([]);
  });
});

describe("coach scope is untouched", () => {
  const shaped = shapeAnalytics(D, "coach");
  test("keeps assessment and watch lists", () => {
    const a = (shaped.years as Record<string, Rec>).all;
    const s = (a.swimmers as Rec[])[0];
    expect(s.cls).toBeDefined();
    expect(Object.keys(a.watch as Rec).length).toBeGreaterThan(0);
  });
});

describe("assessmentFor returns one child only", () => {
  const name = swimmers[0].name as string;
  const one = assessmentFor(D, name);

  test("finds the swimmer", () => {
    expect(one).not.toBeNull();
    expect(one!.name).toBe(name);
  });

  test("carries the assessment", () => {
    expect(one!.cls).toBeDefined();
  });

  test("carries no competition record — that is the other endpoint's job", () => {
    for (const f of ["events", "podiums", "swims", "pbs"]) {
      expect(f in one!).toBe(false);
    }
  });

  test("unknown name returns null rather than something", () => {
    expect(assessmentFor(D, "Nobody, At All")).toBeNull();
  });
});
