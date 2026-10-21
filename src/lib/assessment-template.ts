// The coaches' assessment framework (Felix, 21 Oct 2026).
//
// A shared language for what a coach sees, not a free-text report. Each stroke
// (and starts and turns) is broken into the technique points coaches already
// look at — head position, body position, the arm on the pull, the kick — and
// each point has a short, fixed list of answers: "High elbow", "Dropped
// elbow", "Straight arm". The coach picks one per point; the report sentence
// and the fix come with it, so two coaches who see the same thing write the
// same words.
//
// The vocabulary started from the six video analyses done for Sierra and was
// filled out with the standard points for each stroke.
//
// Shared by the form (/assess) and the report on the analytics page. Point and
// answer ids are stored with each assessment, so an id is never reused for a
// different meaning: retire one and add a new id instead.

export type Tone = "good" | "work";
export type Side = "left" | "right" | "both";

export type Answer = {
  id: string;
  /** What the coach picks from the dropdown: two or three words. */
  label: string;
  tone: Tone;
  /** The sentence in the report. */
  text: string;
  /** What to do about it; every "work" answer has one. */
  fix?: string;
};

export type Point = {
  id: string;
  /** The technique point, as coaches name it. */
  label: string;
  answers: Answer[];
  /** Arm points can be one side only ("right arm: dropped elbow"). */
  sided?: boolean;
};

export type Phase = { title: string; points: Point[] };
export type Area = { id: string; name: string; phases: Phase[] };

const good = (id: string, label: string, text: string): Answer => ({ id, label, tone: "good", text });
const work = (id: string, label: string, text: string, fix: string): Answer => ({ id, label, tone: "work", text, fix });

// ── Off the wall and under the water: the same in every stroke ──

const streamline: Point = {
  id: "streamline",
  label: "Streamline",
  answers: [
    good("tight", "Tight", "Pushes off in a tight streamline, arms squeezed behind the head."),
    work("loose", "Loose, arms apart", "The streamline is loose, with the arms apart, so more of the body meets the water.",
      "Squeeze the arms together behind the head, one hand on top of the other."),
    work("head-up", "Head up", "Lifts the head in the streamline, which adds drag.",
      "Tuck the chin towards the chest so the arms squeeze the ears."),
  ],
};

const dolphin: Point = {
  id: "dolphin",
  label: "Underwater dolphin kick",
  answers: [
    good("both-ways", "Both directions", "Dolphin kicks with effort both up and down."),
    work("down-only", "Down-kick only", "Puts the effort into the down-kick only.",
      "Kick up as hard as down."),
    work("from-knees", "From the knees", "Kicks from the knees rather than the core, so the kick is small.",
      "Start the kick from the core and let it ripple through to the feet."),
  ],
};

const dolphinFeet: Point = {
  id: "dolphin-feet",
  label: "Feet on the kick",
  answers: [
    good("together", "Together", "Keeps the feet together on the dolphin kick."),
    work("apart", "Apart", "The feet separate on the dolphin kick, so water slips through.",
      "Bring the feet together for every kick."),
  ],
};

const kickThrough: Point = {
  id: "kick-through",
  label: "Kicking to the breakout",
  answers: [
    good("steady", "Keeps going", "Keeps the kick going all the way to the breakout."),
    work("eases-off", "Eases off", "Eases off the kick before the breakout and starts the stroke without momentum.",
      "Keep the same kicking effort right up to the breakout."),
  ],
};

const breakout: Point = {
  id: "breakout",
  label: "Breakout",
  answers: [
    good("gradual", "Gradual", "Rises gradually to the surface and carries the momentum into the first stroke."),
    work("slanted", "Slanted, sudden", "Comes up at a slant, changing direction suddenly, which adds drag and loses the momentum from the kicks.",
      "Kick gradually up to the surface rather than turning up sharply."),
    work("breathes-first", "Breathes on first stroke", "Breathes on the first stroke out, which slows the breakout.",
      "Take two strokes before the first breath."),
  ],
};

const offTheWall: Phase = {
  title: "Off the wall and under the water",
  points: [streamline, dolphin, dolphinFeet, kickThrough, breakout],
};

// ── Points shared between strokes ──

const elbow: Point = {
  id: "elbow",
  label: "Arm on the pull",
  sided: true,
  answers: [
    good("high-elbow", "High elbow", "Pulls with a high elbow, the forearm and palm facing the feet."),
    work("dropped-elbow", "Dropped elbow", "Drops the elbow on the pull: the forearm faces the pool floor and pushes water up instead of back.",
      "Lift the elbow to the top of the pull so the forearm and palm face the feet."),
    work("straight-arm", "Straight arm", "Pulls with a straight arm, pressing the water down rather than back.",
      "Bend the elbow at the catch so the forearm faces the feet."),
  ],
};

const bodyFlat: Point = {
  id: "body",
  label: "Body position",
  answers: [
    good("flat", "Flat and high", "The body stays flat and high in the water."),
    work("hips-sink", "Hips and legs sink", "The hips and legs sink, so the body slants and works against the water.",
      "Head neutral and a steady kick to hold the legs at the surface."),
    work("snaking", "Snaking", "The body snakes from side to side.",
      "Keep the hands entering in line with the shoulders and the core firm."),
  ],
};

export const AREAS: Area[] = [
  {
    id: "freestyle",
    name: "Freestyle",
    phases: [
      offTheWall,
      {
        title: "The stroke",
        points: [
          bodyFlat,
          {
            id: "head",
            label: "Head position",
            answers: [
              good("neutral", "Neutral, eyes down", "Keeps the head still and neutral, eyes on the pool floor."),
              work("lifted", "Lifted, looking forward", "Lifts the head to look forward, which drops the hips.",
                "Look at the pool floor just ahead, with the water at the hairline."),
            ],
          },
          {
            id: "entry",
            label: "Hand entry",
            sided: true,
            answers: [
              good("in-line", "In line with shoulder", "The hand enters in line with the shoulder, fingertips first."),
              work("crosses", "Crosses the centre", "The hand crosses the centre line on entry, which pulls the body off line.",
                "Enter in line with the shoulder, as if on train tracks."),
              work("flat", "Flat, slapping", "The hand enters flat and slaps the water.",
                "Enter fingertips first and reach forward under the water."),
            ],
          },
          elbow,
          {
            id: "finish",
            label: "Finish of the pull",
            sided: true,
            answers: [
              good("past-hip", "Past the hip", "Finishes the pull past the hip."),
              work("short", "Short, at the waist", "Takes the hand out at the waist, cutting the pull short.",
                "Push the water all the way back past the hip before recovering."),
            ],
          },
          {
            id: "recovery",
            label: "Arm recovery",
            sided: true,
            answers: [
              good("high-relaxed", "High, relaxed elbow", "Recovers with a high, relaxed elbow."),
              work("straight-wide", "Straight, swinging wide", "Recovers with a straight arm swinging wide, which pulls the body off line.",
                "Lead the recovery with the elbow, fingertips close to the water."),
            ],
          },
          {
            id: "rotation",
            label: "Body rotation",
            answers: [
              good("hips", "Rotates from the hips", "Rotates from the hips and shoulders together."),
              work("flat", "Flat, no rotation", "Swims flat with little rotation, which shortens the stroke.",
                "Roll the hips and shoulders together with each stroke."),
              work("over", "Over-rotates", "Rolls too far onto the side.",
                "Keep the rotation to about forty-five degrees."),
            ],
          },
          {
            id: "breathing",
            label: "Breathing",
            answers: [
              good("low", "Low, one goggle in", "Breathes with a low head turn, one goggle in the water."),
              work("lifts", "Lifts the head", "Lifts the head to breathe, which drops the hips.",
                "Turn the head with the body, keeping one goggle in the water."),
              work("one-side", "One side only", "Breathes to one side only.",
                "Practise breathing every three strokes."),
            ],
          },
          {
            id: "kick",
            label: "Kick",
            answers: [
              good("steady", "Steady, from the hips", "Kicks steadily from the hips with a small, fast kick."),
              work("bent-knees", "Bent knees, cycling", "Bends the knees and cycles, so the kick slows the body down.",
                "Kick from the hips with the legs long and the ankles loose."),
              work("stops", "Stops on the breath", "The kick stops when breathing.",
                "Keep kicking through every breath."),
            ],
          },
        ],
      },
    ],
  },
  {
    id: "backstroke",
    name: "Backstroke",
    phases: [
      {
        title: "The start",
        points: [
          {
            id: "back-start",
            label: "Backstroke start",
            answers: [
              good("arched", "Arched, hands first", "Arches the back and goes in hands first."),
              work("flat", "Flat, sits back", "Sits back into the water rather than arching over it.",
                "Drive the hips up and reach back so the hands enter first."),
            ],
          },
        ],
      },
      offTheWall,
      {
        title: "The stroke",
        points: [
          {
            id: "body",
            label: "Body position",
            answers: [
              good("flat", "Flat at the surface", "The body stays flat, hips at the surface."),
              work("hips-low", "Hips sitting low", "The hips sit low, so the body slants.",
                "Push the hips up and keep the kick continuous."),
            ],
          },
          {
            id: "head",
            label: "Head position",
            answers: [
              good("still", "Still, ears in", "Keeps the head still, ears in the water, eyes up."),
              work("lifted", "Lifted, chin to chest", "Lifts the head, chin towards the chest, which drops the hips.",
                "Rest the head back with the ears in the water."),
              work("moving", "Moving", "The head moves from side to side.",
                "Keep the head still; only the shoulders roll."),
            ],
          },
          {
            id: "kick",
            label: "Kick",
            answers: [
              good("continuous", "Continuous", "Kicks continuously, so the legs stay at the surface."),
              work("stops", "Stops and starts", "Does not kick continuously, so the legs sink and the body slants.",
                "Kick continuously to keep the legs at the surface."),
              work("knees-up", "Knees break the surface", "The knees come out of the water, a cycling kick.",
                "Kick from the hips; only the toes break the surface."),
            ],
          },
          {
            id: "entry",
            label: "Hand entry",
            sided: true,
            answers: [
              good("little-finger", "Little finger first", "The hand enters little finger first, in line with the shoulder."),
              work("back-of-hand", "Back of hand first", "The back of the hand enters first.",
                "Turn the palm out so the little finger enters first."),
              work("crosses", "Behind the head", "The hand crosses behind the head on entry.",
                "Enter in line with the shoulder, at eleven and one o'clock."),
            ],
          },
          {
            id: "pull",
            label: "Arm on the pull",
            sided: true,
            answers: [
              good("bent", "Bent arm", "Pulls with a bent arm, the elbow down by the side."),
              work("straight-deep", "Straight, deep sweep", "Pulls with a straight arm in a deep sweep.",
                "Bend the elbow after the catch and push the water towards the feet."),
            ],
          },
          {
            id: "palm",
            label: "Palm on the pull",
            sided: true,
            answers: [
              good("feet", "Facing the feet", "The palm faces the feet through the pull."),
              work("away", "Turned away", "The palm does not face the feet during the pull, so the other arm works harder to make up for it.",
                "Turn the palm to face the feet through the whole pull."),
            ],
          },
          {
            id: "wrist",
            label: "Wrist",
            sided: true,
            answers: [
              good("firm", "Firm", "Keeps the wrist firm through the pull."),
              work("soft", "Soft, collapses", "The wrist is soft, so the palm collapses during the pull.",
                "Keep the wrist firm from the catch to the finish."),
            ],
          },
          {
            id: "rotation",
            label: "Shoulder rotation",
            answers: [
              good("rolls", "Rolls", "Rolls the shoulders with each stroke."),
              work("flat", "Flat", "Swims flat, without rolling the shoulders.",
                "Lead each pull with the shoulder rolling down."),
            ],
          },
        ],
      },
    ],
  },
  {
    id: "breaststroke",
    name: "Breaststroke",
    phases: [
      {
        title: "Off the wall and the pull-out",
        points: [
          streamline,
          {
            id: "pullout-feet",
            label: "Dolphin kick on the pull-out",
            answers: [
              good("together", "Feet together", "Brings the feet together for the dolphin kick in the pull-out."),
              work("apart", "Feet apart", "The feet separate on the dolphin kick in the pull-out, so water slips through.",
                "Bring the feet together just before the pull-out kick."),
            ],
          },
          {
            id: "pullout-arms",
            label: "Pull-out arms",
            answers: [
              good("palms-feet", "Palms to the feet", "The palms face the feet all the way through the pull-out."),
              work("palms-away", "Palms turn away", "The palms turn away from the feet during the pull-out.",
                "Keep the palms facing the feet through the whole pull-out."),
            ],
          },
        ],
      },
      {
        title: "The stroke",
        points: [
          {
            id: "timing",
            label: "Timing",
            answers: [
              good("pull-kick-glide", "Pull, kick, glide", "The timing is right: pull and breathe, kick, then glide."),
              work("together", "Pulls and kicks together", "Pulls and kicks at the same time, so the two cancel out.",
                "Pull, breathe, kick, glide: the kick starts as the arms shoot forward."),
              work("no-glide", "No glide", "Starts the next pull without a glide.",
                "Hold the streamline for a count of one after each kick."),
            ],
          },
          {
            id: "pull",
            label: "Arm pull",
            answers: [
              good("in-front", "In front of shoulders", "Keeps the pull in front of the shoulders, elbows high."),
              work("too-far", "Past the shoulders", "Pulls back past the shoulders, which slows the recovery.",
                "Keep the hands in front of the shoulders, then shoot them forward."),
            ],
          },
          {
            id: "recovery",
            label: "Arm recovery",
            answers: [
              good("forward", "Straight forwards", "Recovers the arms straight forwards."),
              work("down", "Shooting down", "Shoots the arms downwards on the recovery, so the body dips and loses speed.",
                "Send the arms straight forwards on the recovery, not down."),
            ],
          },
          {
            id: "kick",
            label: "Kick",
            answers: [
              good("whip", "Feet turned out, whip", "Kicks with the feet turned out, driving both legs back together."),
              work("scissor", "Pointed feet, scissor", "The feet stay pointed or move unevenly, a scissor kick that can be disqualified.",
                "Turn the feet out and drive both together."),
              work("knees-wide", "Knees too wide", "The knees open wider than the hips.",
                "Keep the knees about hip-width; the feet go wider than the knees."),
            ],
          },
          {
            id: "head",
            label: "Head position",
            answers: [
              good("in-line", "In line, eyes down", "Keeps the head in line with the body, eyes down."),
              work("lifts", "Lifts high to breathe", "Lifts the head high to breathe.",
                "Let the shoulders rise to breathe; the head stays in line."),
            ],
          },
          {
            id: "glide",
            label: "Body in the glide",
            answers: [
              good("high", "High", "The body stays high in the glide."),
              work("sinks", "Sinks", "The body sinks during the glide.",
                "Recover forwards and press the chest slightly to keep the hips high."),
            ],
          },
        ],
      },
    ],
  },
  {
    id: "butterfly",
    name: "Butterfly",
    phases: [
      offTheWall,
      {
        title: "The stroke",
        points: [
          {
            id: "undulation",
            label: "Body undulation",
            answers: [
              good("chest-press", "Chest press, hips up", "Presses the chest to bring the hips to the surface."),
              work("deep", "Deep, wave-like", "Drives the arms deep before pulling, a wave-like motion that uses a lot of energy.",
                "Keep the arms at the front while pressing the chest down."),
              work("flat", "Flat, hips low", "Swims flat with the hips low.",
                "Press the chest down as the hands enter to lift the hips."),
            ],
          },
          {
            id: "entry",
            label: "Hand entry",
            answers: [
              good("together", "Together, shoulder-width", "The hands enter together, shoulder-width apart."),
              work("uneven", "Uneven", "The hands enter at different times.",
                "Bring both arms over together."),
            ],
          },
          elbow,
          {
            id: "kicks",
            label: "Kicks per stroke",
            answers: [
              good("two", "Two", "Kicks twice per stroke, at the entry and the finish."),
              work("one", "One", "Kicks once per stroke.",
                "Kick as the hands enter and again as they finish."),
            ],
          },
          {
            id: "breathing",
            label: "Breathing",
            answers: [
              good("low", "Low, chin on water", "Breathes low and forward, chin on the water."),
              work("lifts", "Lifts high", "Lifts the head high to breathe, which drops the hips.",
                "Push the chin forward along the water to breathe."),
            ],
          },
          {
            id: "recovery",
            label: "Arm recovery",
            answers: [
              good("over", "Low over the water", "Recovers the arms low and relaxed over the water."),
              work("drags", "Drags through the water", "The arms drag through the water on the recovery.",
                "Finish the pull past the hips so the arms can clear the water."),
            ],
          },
        ],
      },
    ],
  },
  {
    id: "start",
    name: "Starts",
    phases: [
      {
        title: "On the block",
        points: [
          {
            id: "setup",
            label: "Set-up",
            answers: [
              good("track", "Track start, set", "Sets up the track start well: lead leg forward, toes gripping the edge."),
              work("unsteady", "Unsteady", "The set-up on the block is unsteady.",
                "Lead leg forward, rear leg back, toes gripping the edge."),
            ],
          },
          {
            id: "head",
            label: "Head position",
            answers: [
              good("low", "Low, eyes on edge", "Keeps the head low, eyes on the edge of the wall."),
              work("up", "Up", "The head comes up on the block.",
                "Keep the head low with the eyes on the edge of the wall."),
            ],
          },
          {
            id: "hips",
            label: "Hips",
            answers: [
              good("above-head", "Above the head", "Sets the hips higher than the head."),
              work("low", "Level or below", "The hips are no higher than the head, which sets up a poor entry.",
                "Raise the hips above the head before the start."),
            ],
          },
        ],
      },
      {
        title: "Flight and entry",
        points: [
          {
            id: "rear-kick",
            label: "Rear-leg kick",
            answers: [
              good("kicks", "Kicks up", "Kicks the rear leg up in flight to lift the lower body."),
              work("none", "No kick", "The rear leg does not kick up in flight.",
                "Kick the rear leg up hard as the feet leave the block."),
            ],
          },
          {
            id: "entry",
            label: "Entry",
            answers: [
              good("one-hole", "Through one hole", "The hands and feet go in through the same point."),
              work("two-points", "Hands and feet apart", "The hands and feet enter at different points.",
                "Jump higher and kick up harder in flight so the feet follow the hands in."),
              work("flat", "Flat", "Enters flat, slapping the water.",
                "Aim the hands at a point in the water and follow them in."),
            ],
          },
          {
            id: "back-start",
            label: "Backstroke start",
            answers: [
              good("arched", "Arched, hands first", "Arches the back and goes in hands first."),
              work("flat", "Flat, sits back", "Sits back into the water rather than arching over it.",
                "Drive the hips up and reach back so the hands enter first."),
            ],
          },
        ],
      },
      { title: "Under the water", points: [dolphin, dolphinFeet, breakout] },
    ],
  },
  {
    id: "turns",
    name: "Turns",
    phases: [
      {
        title: "Open turn (breaststroke and butterfly)",
        points: [
          {
            id: "approach",
            label: "Approach",
            answers: [
              good("reaches", "Reaches", "Reaches for the wall with the arms shooting forwards."),
              work("dives", "Dives at the wall", "Dives at the wall instead of reaching for it, which is slower.",
                "Reach for the wall by shooting the arms forwards."),
              work("glides-in", "Glides in short", "Glides into the wall short of a full stroke.",
                "Adjust the last strokes so the hands arrive at full reach."),
            ],
          },
          {
            id: "touch",
            label: "Touch",
            answers: [
              good("two-hands", "Two hands, level", "Touches with both hands at once, on the same level."),
              work("uneven", "One hand or uneven", "The touch is one-handed or uneven, which risks a disqualification.",
                "Touch with both hands at once, below the pole at the end of the lane, and practise it in training."),
            ],
          },
          {
            id: "hand-on-wall",
            label: "Support on the wall",
            answers: [
              good("holds", "Hand stays on", "Keeps a hand on the wall for support while turning."),
              work("lets-go", "Lets go early", "Lets go of the wall early and turns without support, which slows the turn.",
                "Keep one hand on the wall while turning, then bring it into the streamline before pushing off."),
            ],
          },
          {
            id: "stay-low",
            label: "Height in the turn",
            answers: [
              good("low", "Low", "Stays low in the water through the turn."),
              work("high", "Lifts high", "Lifts the body high out of the water to turn.",
                "Touch below the edge of the wall so the turn stays low."),
            ],
          },
        ],
      },
      {
        title: "Tumble turn (freestyle and backstroke)",
        points: [
          {
            id: "distance",
            label: "Distance from the wall",
            answers: [
              good("right", "Right distance", "Turns at the right distance from the wall."),
              work("close", "Too close", "Turns too close to the wall, so the push-off is cramped.",
                "Start the turn a little further out, so the feet land with the knees bent at about ninety degrees."),
              work("far", "Too far", "Turns too far from the wall, so the push-off is weak.",
                "Start the turn a little closer, so the feet land with the knees bent at about ninety degrees."),
            ],
          },
          {
            id: "arms",
            label: "Arms in the turn",
            answers: [
              good("locked", "Locked by sides", "Locks the arms by the sides for support during the turn."),
              work("loose", "Loose", "The arms are loose during the turn.",
                "Lock the arms by the sides through the somersault."),
            ],
          },
          {
            id: "feet",
            label: "Feet on the wall",
            answers: [
              good("planted", "Planted, chest up", "Plants the feet on the wall with the chest facing up."),
              work("uneven", "Uneven", "The feet land unevenly on the wall.",
                "Plant both feet on the wall with the chest facing up, then rotate on the push-off."),
            ],
          },
        ],
      },
    ],
  },
];

export const areaById = (id: string) => AREAS.find((a) => a.id === id) ?? null;

/** Every point of an area once (a shared phase can appear in several areas). */
export const pointsOf = (area: Area) => {
  const m = new Map<string, Point>();
  for (const p of area.phases) for (const pt of p.points) m.set(pt.id, pt);
  return m;
};

/** What a coach records against one point: the answer picked, and for an arm, which side. */
export type Pick = { answer: string; side?: Side };

export type AssessmentBody = {
  area: string;
  filmedOn: string; // YYYY-MM-DD, the date of the session assessed
  picks: Record<string, Pick>;
  /** Up to three point ids, most important first. */
  priorities: string[];
  note: string;
};

const sideWord = (s?: Side) => (s === "left" ? "Left arm: " : s === "right" ? "Right arm: " : "");

/** The report in standard language, as lines a page can lay out. */
export function report(body: AssessmentBody) {
  const area = areaById(body.area);
  const points = area ? pointsOf(area) : new Map<string, Point>();
  const goodLines: string[] = [];
  const workLines: { id: string; text: string; fix: string }[] = [];
  for (const [id, p] of Object.entries(body.picks ?? {})) {
    const a = points.get(id)?.answers.find((x) => x.id === p.answer);
    if (!a) continue;
    if (a.tone === "good") goodLines.push(a.text);
    else workLines.push({ id, text: sideWord(p.side) + a.text, fix: a.fix ?? "" });
  }
  const order = (id: string) => {
    const i = body.priorities.indexOf(id);
    return i < 0 ? 99 : i;
  };
  workLines.sort((a, b) => order(a.id) - order(b.id));
  return {
    title: area ? `${area.name} assessment` : "Assessment",
    good: goodLines,
    work: workLines.map((w) => ({ ...w, priority: body.priorities.includes(w.id) })),
    note: body.note,
  };
}
