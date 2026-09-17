import { CONSENT_VERSION } from "@/lib/consent-version";

// The consent document itself, in one place.
//
// It is a component rather than a string so the registration screen and the
// "what did I agree to" view on a guardian's profile render exactly the same
// words — a guardian who wants to check what they consented to must not be
// shown a paraphrase.
//
// If this text changes, bump CONSENT_VERSION. Guardians on an older version are
// asked to accept the new one before they reach the dashboard, and the old
// acceptance stays on record rather than being overwritten.
export function ConsentText() {
  return (
    <div className="max-h-[42vh] overflow-y-auto rounded-xl border border-white/15 bg-black/20 p-4 text-[13.4px] leading-relaxed text-white/75">
      <h2 className="text-[15px] font-semibold text-white">
        How NextGen uses your child's swimming data
      </h2>

      <p className="mt-3">
        We record your child's race results and use them to help them swim better.{" "}
        <strong className="text-white">That is the only thing we use this data for.</strong>
      </p>

      <h3 className="mt-4 font-semibold text-white">What we hold</h3>
      <p className="mt-1">
        Their name, age group, and the results of meets they have swum — times, places and
        personal bests. Meet results are already published by the organisers of each competition.
        We hold your name, phone number and email so the club can reach you.
      </p>

      <h3 className="mt-4 font-semibold text-white">Who can see what</h3>
      <p className="mt-1">
        Anyone in the NextGen community who has been confirmed as a parent or guardian can see
        race results for all NextGen swimmers — the way SwimCloud and Meet Mobile work.
      </p>
      <p className="mt-2">
        Coaching assessments — how a swimmer is developing, what they should work on — are shown
        only to the coaches and to that child's own parents or guardians.{" "}
        <strong className="text-white">No other family sees an assessment of your child.</strong>
      </p>

      <h3 className="mt-4 font-semibold text-white">What we will not do</h3>
      <p className="mt-1">
        We will not sell this data, share it with anyone outside NextGen, or use it for anything
        other than your child's development and the running of the club.
      </p>

      <h3 className="mt-4 font-semibold text-white">Your choices</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        <li>You can ask us to keep your child out of the club-wide view at any time.</li>
        <li>
          You can withdraw this consent at any time, and your child's name will be removed from
          what other families can see.
        </li>
        <li>You can ask for a copy of everything we hold about your family.</li>
        <li>
          Children do not give or withdraw consent. That stays with you as their parent or
          guardian.
        </li>
      </ul>

      <p className="mt-4 text-[12.5px] text-white/45">
        NextGen Multi Sport Academy is the data controller. Version {CONSENT_VERSION}. To ask
        about any of this, or to exercise any of the choices above, speak to a club coordinator.
      </p>
    </div>
  );
}
