import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useClaimable, useClaimSwimmer } from "@/lib/api";

// Find your swimmer, and put yourself on their record.
//
// A child normally has two adults, and both need to see the registration, the
// balance and the swimming. Before this, only the adult who happened to
// register could see anything, and the second was told the child "is already
// registered by another parent" — which reads as an accusation when it is
// usually the other half of the household.
//
// The roster is searched rather than listed: these are children's names, so
// nothing appears until someone types a name they already know.
//
// `dark` renders it on the navy registration screens; the default light form is
// for the parent dashboard.
//
// `squadOnly` marks a child the club has not put in the Nationals team. It used
// to DISABLE them, which turned this search into a dead end: a parent could see
// her daughter and not add her, with nothing on the screen to do next. Claiming
// a child is about whose account they are on, not which meet they are in — two
// different questions, and conflating them locked a real parent out on the
// morning of a registration. The row now says where they stand and still adds
// them; whether they can be ENTERED for Machakos is decided further down the
// page, where the club's squad is what counts.
//
// `confirmBeforeAdd` puts one deliberate step between the search result and the
// link. Registration does not need it — that flow ends on a screen listing
// every swimmer being added, which is a better place to catch a mistake than a
// prompt attached to each row. The Nationals page has no such screen: a parent
// is adding a child mid-task, next to a payment, and a link now takes effect
// immediately, so that is where the question gets asked.
export function FindSwimmer({
  onClaimed,
  dark = false,
  confirmBeforeAdd = false,
  squadOnly = false,
}: {
  onClaimed?: (name: string) => void;
  dark?: boolean;
  confirmBeforeAdd?: boolean;
  squadOnly?: boolean;
}) {
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  // A swimmer who already has one adult: the second gives their own number,
  // which is what tells the club they are a different person and becomes the
  // identity their account is known by.
  const [phoneFor, setPhoneFor] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const results = useClaimable(debounced);
  const claim = useClaimSwimmer();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term), 250);
    return () => clearTimeout(t);
  }, [term]);

  const found = results.data ?? [];
  const searching = debounced.trim().length >= 2;

  async function add(id: string, name: string, withPhone?: string) {
    setError(null);
    setConfirming(null);
    try {
      await claim.mutateAsync({ swimmerId: id, phone: withPhone });
      setTerm("");
      setDebounced("");
      setPhoneFor(null);
      setPhone("");
      onClaimed?.(name);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not add that swimmer.";
      // The server asks for a number when somebody else already holds the
      // child; that is a step, not a failure, so it opens the field rather
      // than printing a refusal.
      // Keyed on the one phrase both phone replies share, rather than on the
      // wording of either — the wording changed once already and this silently
      // stopped opening the field.
      if (/phone number/i.test(msg)) {
        setPhoneFor(id);
        setError(null);
      } else {
        setError(msg);
      }
    }
  }

  function attempt(id: string, name: string, adults: number) {
    // Already spoken for: the number comes first, whichever screen this is.
    if (adults > 0) {
      setPhoneFor(id);
      setConfirming(null);
      return;
    }
    if (confirmBeforeAdd) {
      setConfirming(id);
      return;
    }
    void add(id, name);
  }

  return (
    <div className="space-y-3">
      <div>
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search your child's name…"
          aria-label="Search for your swimmer by name"
          className={dark ? "ng-field" : "h-11"}
        />
        <p className={"mt-1.5 text-xs " + (dark ? "text-white/45" : "text-muted-foreground")}>
          Type at least two letters. Only a parent or guardian registers a swimmer. If one parent is
          already on a child, the second confirms their own phone number to join.
        </p>
      </div>

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      {searching && results.isLoading && (
        <p className={"text-xs " + (dark ? "text-white/50" : "text-muted-foreground")}>
          Searching…
        </p>
      )}

      {searching && !results.isLoading && found.length === 0 && (
        <p
          className={
            "rounded-lg px-3 py-2.5 text-xs " +
            (dark ? "bg-white/[.06] text-white/60" : "bg-secondary text-muted-foreground")
          }
        >
          No swimmer matches that name, or the ones that do already have two parents on the record.
          Ask the coordinator if that is not right.
        </p>
      )}

      {/* On the Nationals page a child who is not in the squad is still shown —
          hiding them reads as "we have lost your child" — but greyed and
          unselectable, because nothing here can enter them for a meet they are
          not in. */}
      {found.length > 0 && (
        <ul
          className={
            "overflow-hidden rounded-xl border " +
            (dark
              ? "divide-y divide-white/10 border-white/15"
              : "divide-y divide-border border-border")
          }
        >
          {found.map((s) => {
            const offSquad = squadOnly && !s.inSquad;
            return (
              <li key={s.id} className={dark ? "bg-white/[.03]" : "bg-card"}>
                <div className="flex items-center gap-3 px-3.5 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span
                      className={"block truncate text-sm font-medium " + (dark ? "text-white" : "")}
                    >
                      {s.name}
                    </span>
                    <span
                      className={
                        "block text-xs " + (dark ? "text-white/50" : "text-muted-foreground")
                      }
                    >
                      {offSquad
                        ? "Not in the Nationals team — you can still add them to your account"
                        : s.mine
                          ? "On your record"
                          : s.adults === 0
                            ? "Not yet on any parent's account"
                            : "One parent already · you can be the second"}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant={s.mine ? "outline" : "default"}
                    disabled={s.mine || claim.isPending}
                    onClick={() => attempt(s.id, s.name, s.adults)}
                  >
                    {s.mine ? "Added" : "This is my child"}
                  </Button>
                </div>

                {phoneFor === s.id && (
                  <div
                    className={
                      "border-t px-3.5 py-3 " +
                      (dark ? "border-white/10 bg-white/[.05]" : "border-border bg-secondary")
                    }
                  >
                    <p className="text-[13px] leading-relaxed">
                      <b>{s.name}</b> already has one parent on the record. Confirm your own phone
                      number and you will be added as the second — it must be a different number
                      from theirs.
                    </p>
                    <input
                      className={
                        "mt-2.5 w-full rounded-lg px-3 py-2 text-sm " +
                        (dark ? "ng-field" : "border border-border bg-background")
                      }
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="0712 345 678"
                      aria-label="Your phone number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={claim.isPending || phone.trim().length < 9}
                        onClick={() => void add(s.id, s.name, phone.trim())}
                      >
                        Confirm and add {s.name}
                      </Button>
                      {/* outline is a light-mode variant: on the dark panel it
                        came out a solid white slab, louder than the action
                        beside it. */}
                      <Button
                        size="sm"
                        variant={dark ? "ghost" : "outline"}
                        className={
                          dark
                            ? "border border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                            : ""
                        }
                        onClick={() => {
                          setPhoneFor(null);
                          setPhone("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {confirming === s.id && (
                  <div
                    className={
                      "border-t px-3.5 py-3 " +
                      (dark ? "border-white/10 bg-white/[.05]" : "border-border bg-secondary")
                    }
                  >
                    <p className="text-[13px] leading-relaxed">
                      Add <b>{s.name}</b> to your account? Please confirm you are their parent or
                      guardian. They will be entered and paid for under your name.
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={claim.isPending}
                        onClick={() => void add(s.id, s.name)}
                      >
                        Yes, {s.name} is my child
                      </Button>
                      <Button
                        size="sm"
                        variant={dark ? "ghost" : "outline"}
                        className={
                          dark
                            ? "border border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                            : ""
                        }
                        onClick={() => setConfirming(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
