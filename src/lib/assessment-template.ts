// The coaches' assessment template (Felix, 21 Oct 2026).
//
// Built from the six video analyses done for Sierra (freestyle, backstroke,
// breaststroke, butterfly, starts, turns). Each report walked the same path —
// off the wall or the block, under the water, the breakout, then the stroke —
// and kept reaching for the same few observations in slightly different
// words. Here each observation is written once, as what good looks like, what
// the coach saw instead, and the fix, so every child's report reads the same
// way whichever coach filmed them.
//
// Shared by the form (/assess) and the report on the analytics page. Ids are
// stored with each assessment, so an id is never reused for a different
// meaning: retire one and add a new id instead.

export type Mark = "good" | "work";
export type Side = "left" | "right" | "both";

export type Item = {
  id: string;
  /** What the coach is looking at, as a short heading. */
  label: string;
  /** The sentence for the report when this is done well. */
  good: string;
  /** The sentence for the report when it needs work. */
  work: string;
  /** What to do about it. */
  fix: string;
  /** Arm items can be one side only ("her right palm"). */
  sided?: boolean;
};

export type Phase = { title: string; items: Item[] };
export type Area = { id: string; name: string; filmed: string; phases: Phase[] };

// Off the wall and under the water: the same for all four strokes in the
// reports, so written once and shared.
const offTheWall: Phase = {
  title: "Off the wall and under the water",
  items: [
    {
      id: "streamline",
      label: "Streamline off the wall",
      good: "Pushes off in a tight streamline, arms squeezed behind the head, so less of the body meets the water.",
      work: "The streamline off the wall is loose.",
      fix: "Squeeze the arms together behind the head and tuck the chin towards the chest.",
    },
    {
      id: "dolphin-both",
      label: "Dolphin kick, both directions",
      good: "Dolphin kicks with effort both up and down.",
      work: "Puts the effort into the down-kick only.",
      fix: "Kick up as hard as down, with the kick starting from the core.",
    },
    {
      id: "dolphin-feet",
      label: "Feet together on the kick",
      good: "Keeps the feet together on the dolphin kick.",
      work: "The feet separate during the dolphin kick, so water slips through.",
      fix: "Bring the feet together for every dolphin kick.",
    },
    {
      id: "kick-through",
      label: "Kicking through to the breakout",
      good: "Keeps the kick going all the way to the breakout.",
      work: "Eases off the kick just before the breakout and starts the stroke without momentum.",
      fix: "Keep the same kicking effort right up to the breakout.",
    },
    {
      id: "breakout",
      label: "Breakout",
      good: "Rises to the surface gradually and carries the momentum into the first stroke.",
      work: "The body is slanted at the breakout, which adds drag and loses the momentum from the kicks.",
      fix: "Kick gradually up to the surface rather than changing direction suddenly.",
    },
  ],
};

const highElbow: Item = {
  id: "high-elbow",
  label: "High elbow on the pull",
  good: "Pulls with a high elbow, forearm and palm facing the feet.",
  work: "Drops the elbow on the pull: the forearm faces the pool floor and pushes water up instead of back.",
  fix: "Lift the elbow to the top of the pull so the forearm and palm face the feet. Most of the speed in this stroke comes from the pull.",
  sided: true,
};

const flatBody: Item = {
  id: "body-flat",
  label: "Body position",
  good: "The body stays flat and high in the water.",
  work: "The legs and hips sink, so the body slants and has to work against the water.",
  fix: "Keep a steady, continuous kick to hold the legs at the surface.",
};

export const AREAS: Area[] = [
  {
    id: "freestyle",
    name: "Freestyle",
    filmed: "Swam a full length of freestyle, filmed from four angles.",
    phases: [offTheWall, { title: "The stroke", items: [flatBody, highElbow] }],
  },
  {
    id: "backstroke",
    name: "Backstroke",
    filmed: "Swam a full length of backstroke, filmed from four angles.",
    phases: [
      {
        title: "The start",
        items: [
          {
            id: "back-start",
            label: "Backstroke start",
            good: "Arches the back and goes in hands first, so little of the body meets the water.",
            work: "The backstroke start is flat or goes in feet first.",
            fix: "Arch the back and reach back so the hands enter first.",
          },
        ],
      },
      offTheWall,
      {
        title: "The stroke",
        items: [
          {
            id: "kick-continuous",
            label: "Continuous kick",
            good: "Kicks continuously, so the legs stay at the surface.",
            work: "Does not kick continuously, so the legs sink and the body slants.",
            fix: "Kick continuously to keep the legs at the surface.",
          },
          {
            id: "palm-feet",
            label: "Palm facing the feet",
            good: "The palm faces the feet through the pull.",
            work: "The palm does not face the feet during the pull, so the other arm works harder to make up for it.",
            fix: "Turn the palm to face the feet through the whole pull.",
            sided: true,
          },
          {
            id: "wrist-firm",
            label: "Firm wrist",
            good: "Keeps the wrist firm through the pull.",
            work: "The wrist is soft, so the palm collapses during the pull.",
            fix: "Keep the wrist firm from the catch to the finish.",
            sided: true,
          },
        ],
      },
    ],
  },
  {
    id: "breaststroke",
    name: "Breaststroke",
    filmed: "Swam a full length of breaststroke, filmed from four angles.",
    phases: [
      {
        title: "Off the wall and the pull-out",
        items: [
          offTheWall.items[0],
          {
            id: "pullout-feet",
            label: "Feet together on the pull-out kick",
            good: "Brings the feet together for the dolphin kick in the pull-out.",
            work: "The feet separate on the dolphin kick in the pull-out, so water slips through.",
            fix: "Bring the feet together just before the pull-out kick.",
          },
          {
            id: "pullout-palms",
            label: "Pull-out",
            good: "Palms face the feet all the way through the pull-out.",
            work: "The palms turn away from the feet during the pull-out.",
            fix: "Keep the palms facing the feet through the whole pull-out.",
          },
        ],
      },
      {
        title: "The stroke",
        items: [
          {
            id: "recovery-forward",
            label: "Arm recovery",
            good: "Recovers the arms straight forwards.",
            work: "Shoots the arms downwards on the recovery, so the body dips and loses speed.",
            fix: "Send the arms straight forwards on the recovery, not down.",
          },
          {
            id: "glide-high",
            label: "Body in the glide",
            good: "The body stays high in the glide.",
            work: "The body sinks during the glide.",
            fix: "Recover forwards and press the chest slightly to keep the hips high in the glide.",
          },
        ],
      },
    ],
  },
  {
    id: "butterfly",
    name: "Butterfly",
    filmed: "Swam a full length of butterfly, filmed from four angles.",
    phases: [
      offTheWall,
      {
        title: "The stroke",
        items: [
          {
            id: "arms-front",
            label: "Arms at the front",
            good: "Keeps the arms at the front while pressing the chest down.",
            work: "Drives the arms deep before pulling, a wave-like motion that uses a lot of energy and tires the swimmer.",
            fix: "Keep the arms at the front when pressing the chest down to bring the hips up.",
          },
          highElbow,
        ],
      },
    ],
  },
  {
    id: "start",
    name: "Starts",
    filmed: "Filmed doing the dive start, underwater kicks and breakout.",
    phases: [
      {
        title: "On the block",
        items: [
          {
            id: "track-setup",
            label: "Set-up",
            good: "Sets up the track start well: lead leg forward, toes gripping the edge.",
            work: "The set-up on the block is unsteady.",
            fix: "Lead leg forward, rear leg back, toes gripping the edge.",
          },
          {
            id: "head-low",
            label: "Head position",
            good: "Keeps the head low, eyes on the edge of the wall.",
            work: "The head comes up on the block.",
            fix: "Keep the head low with the eyes on the edge of the wall.",
          },
          {
            id: "hips-high",
            label: "Hips above the head",
            good: "Sets the hips higher than the head.",
            work: "The hips are no higher than the head, which sets up a poor entry.",
            fix: "Raise the hips above the head before the start.",
          },
        ],
      },
      {
        title: "Flight and entry",
        items: [
          {
            id: "rear-kick",
            label: "Rear-leg kick",
            good: "Kicks the rear leg up in flight to lift the lower body.",
            work: "The rear leg does not kick up in flight.",
            fix: "Kick the rear leg up hard as the feet leave the block.",
          },
          {
            id: "clean-entry",
            label: "Clean entry",
            good: "Hands and feet go in through the same point.",
            work: "The hands and feet enter at different points.",
            fix: "Jump higher and kick up harder in flight so the feet follow the hands in.",
          },
          {
            id: "back-start",
            label: "Backstroke start",
            good: "Arches the back and goes in hands first.",
            work: "The backstroke start is flat or goes in feet first.",
            fix: "Arch the back and reach back so the hands enter first.",
          },
        ],
      },
      { title: "Under the water", items: [offTheWall.items[1], offTheWall.items[2], offTheWall.items[4]] },
    ],
  },
  {
    id: "turns",
    name: "Turns",
    filmed: "Filmed doing open and tumble turns.",
    phases: [
      {
        title: "Open turn (breaststroke and butterfly)",
        items: [
          {
            id: "reach-wall",
            label: "Approach",
            good: "Reaches for the wall with the arms shooting forwards.",
            work: "Dives at the wall instead of reaching for it, which is slower.",
            fix: "Reach for the wall by shooting the arms forwards.",
          },
          {
            id: "two-hand-touch",
            label: "Touch",
            good: "Touches with both hands at once, on the same level.",
            work: "The touch is one-handed or uneven, which risks a disqualification.",
            fix: "Touch with both hands at once, below the pole at the end of the lane, and practise it in training so it holds up at galas.",
          },
          {
            id: "hand-on-wall",
            label: "Support on the wall",
            good: "Keeps a hand on the wall for support while turning.",
            work: "Lets go of the wall early and turns without support, which slows the turn.",
            fix: "Keep one hand on the wall while turning, then bring it into the streamline before pushing off.",
          },
          {
            id: "stay-low",
            label: "Staying low",
            good: "Stays low in the water through the turn.",
            work: "Lifts the body high out of the water to turn.",
            fix: "Touch below the edge of the wall so the turn stays low.",
          },
        ],
      },
      {
        title: "Tumble turn (freestyle and backstroke)",
        items: [
          {
            id: "turn-distance",
            label: "Distance from the wall",
            good: "Turns at the right distance from the wall.",
            work: "Turns too close to, or too far from, the wall.",
            fix: "Start the turn a little further out (or in), so the feet land with the knees bent.",
          },
          {
            id: "arms-locked",
            label: "Arms during the turn",
            good: "Locks the arms by the sides for support during the turn.",
            work: "The arms are loose during the turn.",
            fix: "Lock the arms by the sides through the somersault.",
          },
          {
            id: "feet-planted",
            label: "Push-off position",
            good: "Plants the feet on the wall with the chest facing up.",
            work: "The feet land unevenly on the wall.",
            fix: "Plant both feet on the wall with the chest facing up, then rotate on the push-off.",
          },
        ],
      },
    ],
  },
];

export const areaById = (id: string) => AREAS.find((a) => a.id === id) ?? null;

/** What a coach records against one item. */
export type ItemMark = { mark: Mark; side?: Side; note?: string };

export type AssessmentBody = {
  area: string;
  filmedOn: string; // YYYY-MM-DD
  filmed: string; // how it was filmed; defaults to the area's sentence
  marks: Record<string, ItemMark>;
  /** Up to three item ids, most important first. */
  priorities: string[];
  note: string;
};

const sideWord = (s?: Side) => (s === "left" ? "Left arm: " : s === "right" ? "Right arm: " : "");

/** The report in standard language, as lines a page can lay out. */
export function report(body: AssessmentBody) {
  const area = areaById(body.area);
  const items = new Map<string, Item>();
  for (const p of area?.phases ?? []) for (const i of p.items) items.set(i.id, i);
  const good: string[] = [];
  const work: { id: string; text: string; fix: string; note?: string }[] = [];
  for (const [id, m] of Object.entries(body.marks)) {
    const it = items.get(id);
    if (!it) continue;
    if (m.mark === "good") good.push(it.good + (m.note ? ` ${m.note}` : ""));
    else work.push({ id, text: sideWord(m.side) + it.work, fix: it.fix, note: m.note || undefined });
  }
  const order = (id: string) => {
    const i = body.priorities.indexOf(id);
    return i < 0 ? 99 : i;
  };
  work.sort((a, b) => order(a.id) - order(b.id));
  return {
    title: area ? `${area.name} assessment` : "Assessment",
    filmed: body.filmed || area?.filmed || "",
    good,
    work: work.map((w) => ({ ...w, priority: body.priorities.includes(w.id) })),
    note: body.note,
  };
}
