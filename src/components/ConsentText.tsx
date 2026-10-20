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
//
// Version 2026-10-20 (Felix, for launch): rewritten against Kenya's Data
// Protection Act 2019, covering coaches as well as parents, with a contact and
// a retention period. Server locations are not named; that data is held
// outside Kenya is (the Act requires it).
export function ConsentText() {
  return (
    <div className="max-h-[42vh] overflow-y-auto rounded-xl border border-white/15 bg-black/20 p-4 text-[13.4px] leading-relaxed text-white/75">
      <h2 className="text-[15px] font-semibold text-white">How NextGen uses your information</h2>

      <p className="mt-3">
        NextGen Multi Sport Academy (&ldquo;NextGen&rdquo;) runs NextGen Analytics and Events.
        Golden Pipit Solutions builds and runs the app for us.
      </p>

      <h3 className="mt-4 font-semibold text-white">What we hold</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        <li>
          <strong className="text-white">About you:</strong> your name, email, phone number, and
          whether you are a parent, guardian or coach.
        </li>
        <li>
          <strong className="text-white">About your child:</strong> their name, age group, and the
          results of the galas they swim: times, places and personal bests, as published by the
          meet organisers.
        </li>
        <li>
          <strong className="text-white">For events you enter:</strong> the entry details you give
          us, including any health or dietary notes, and your payments.
        </li>
        <li>
          <strong className="text-white">A sign-in record:</strong> when you ask for a code and
          sign in. No tracking and no advertising.
        </li>
      </ul>

      <h3 className="mt-4 font-semibold text-white">Who sees what</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        <li>
          Every confirmed NextGen parent or guardian can see the race results of all NextGen
          swimmers. These results are already public.
        </li>
        <li>
          Assessments and coaching notes about a child are seen only by the club&rsquo;s coaches,
          its administrators, and that child&rsquo;s own parents or guardians.
        </li>
        <li>
          <strong className="text-white">
            We never sell your information or share it with advertisers.
          </strong>
        </li>
      </ul>

      <h3 className="mt-4 font-semibold text-white">Why we hold it</h3>
      <p className="mt-1">
        To show each family their swimmer&rsquo;s progress, to help our coaches plan training, and
        to run club events. We rely on your consent, which you give here as the child&rsquo;s
        parent or guardian. Children do not give or withdraw consent themselves.
      </p>

      <h3 className="mt-4 font-semibold text-white">Who helps us</h3>
      <p className="mt-1">
        Trusted service providers, some of them outside Kenya, run the app, store the data and send
        our emails, and may analyse race results to help our coaches. They act only on our
        instructions, keep your information secure, and may not use it for their own purposes.
      </p>

      <h3 className="mt-4 font-semibold text-white">How long we keep it</h3>
      <p className="mt-1">
        While your child swims with NextGen, and for two years after, unless you ask us to delete
        it sooner. Published race results stay in the club&rsquo;s records.
      </p>

      <h3 className="mt-4 font-semibold text-white">Your rights</h3>
      <p className="mt-1">
        Under Kenya&rsquo;s Data Protection Act, 2019, you can ask to see the information we hold
        about you and your child, to correct it, or to delete it, and you can withdraw this consent
        at any time; withdrawing closes your access. To do any of these, email{" "}
        <a
          href="mailto:hello@goldenpipitsolutions.com"
          className="text-[var(--ng-cyan)] underline underline-offset-2"
        >
          hello@goldenpipitsolutions.com
        </a>
        . You can also complain to the Office of the Data Protection Commissioner (odpc.go.ke).
      </p>

      <p className="mt-4 text-[12.5px] text-white/45">
        NextGen Multi Sport Academy is the data controller. Version {CONSENT_VERSION}.
      </p>
    </div>
  );
}
