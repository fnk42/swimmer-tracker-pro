import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useClaimable, useClaimSwimmer, useMe } from "@/lib/api";

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
// `dark` renders it on the navy registration screens; the default light form is
// for the parent dashboard.
// Names, reduced to the parts worth comparing. Punctuation and case go, and
// anything one letter long goes with them — a middle initial is not a surname.
// A hyphen separates rather than joins, so a parent called Wambui-Gitau still
// matches a child called Gitau. An apostrophe is kept: it is part of the name.
const parts = (name: string) =>
  (name || "")
    .toLowerCase()
    .replace(/[^a-z']+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);

/**
 * Does this swimmer's name share a surname with the claiming adult?
 *
 * Deliberately generous. A household can carry two surnames, a parent may go by
 * a double-barrelled name, and a mother's surname often differs from her
 * children's — so any overlap at all counts as a match, and only a complete
 * absence of one is worth asking about. Unknown either way is never a flag:
 * there is no surer way to train someone to click past a warning than to show
 * it when nothing is wrong.
 */
function surnameLooksOff(parentName: string, swimmerName: string): boolean {
  const p = parts(parentName);
  const c = parts(swimmerName);
  if (p.length < 2 || c.length < 2) return false;
  return !p.some((w) => c.includes(w));
}

export function FindSwimmer({ onClaimed, dark = false, parentName }:
  { onClaimed?: () => void; dark?: boolean; parentName?: string }) {
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [error, setError] = useState<string | null>(null);
  // The one the parent has been asked to confirm, because the name does not
  // look like theirs.
  const [confirming, setConfirming] = useState<string | null>(null);
  const me = useMe();
  const results = useClaimable(debounced);
  const claim = useClaimSwimmer();

  // During registration the profile has not been saved yet, so the name comes
  // from the form; afterwards it comes from the account.
  const whoIAm = (parentName ?? "").trim() || me.data?.parent?.fullName || "";

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term), 250);
    return () => clearTimeout(t);
  }, [term]);

  const found = results.data ?? [];
  const searching = debounced.trim().length >= 2;

  async function add(id: string) {
    setError(null);
    setConfirming(null);
    try {
      await claim.mutateAsync(id);
      setTerm("");
      setDebounced("");
      onClaimed?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add that swimmer.");
    }
  }

  // A link now takes effect the moment it is made, so this is the last point at
  // which a mis-click can be caught by the person who knows the answer.
  function attempt(id: string, name: string) {
    if (surnameLooksOff(whoIAm, name)) { setConfirming(id); return; }
    void add(id);
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
          Type at least two letters. Two adults can be on the same swimmer, and a swimmer you
          add can see their results straight away.
        </p>
      </div>

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      {searching && results.isLoading && (
        <p className={"text-xs " + (dark ? "text-white/50" : "text-muted-foreground")}>Searching…</p>
      )}

      {searching && !results.isLoading && found.length === 0 && (
        <p className={"rounded-lg px-3 py-2.5 text-xs " +
          (dark ? "bg-white/[.06] text-white/60" : "bg-secondary text-muted-foreground")}>
          No swimmer matches that name, or the ones that do already have two adults on the
          record. Ask the coordinator if that is not right.
        </p>
      )}

      {found.length > 0 && (
        <ul className={"overflow-hidden rounded-xl border " +
          (dark ? "divide-y divide-white/10 border-white/15" : "divide-y divide-border border-border")}>
          {found.map((s) => (
            <li key={s.id} className={(dark ? "bg-white/[.03]" : "bg-card")}>
              <div className="flex items-center gap-3 px-3.5 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className={"block truncate text-sm font-medium " + (dark ? "text-white" : "")}>
                    {s.name}
                  </span>
                  <span className={"block text-xs " + (dark ? "text-white/50" : "text-muted-foreground")}>
                    {s.mine
                      ? "On your record"
                      : s.adults === 0
                        ? "No adult linked yet"
                        : "One adult already linked · one place left"}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant={s.mine ? "outline" : "default"}
                  disabled={s.mine || claim.isPending}
                  onClick={() => attempt(s.id, s.name)}
                >
                  {s.mine ? "Added" : "This is my child"}
                </Button>
              </div>

              {confirming === s.id && (
                <div className={"border-t px-3.5 py-3 " +
                  (dark ? "border-white/10 bg-[#FFC24B]/10" : "border-border bg-amber-50")}>
                  <p className={"text-[13px] leading-relaxed " +
                    (dark ? "text-white/80" : "text-amber-900")}>
                    <b>{s.name}</b> does not share a surname with{" "}
                    <b>{whoIAm}</b>. That is perfectly normal in plenty of families &mdash; we
                    just want to be sure this is the right child before adding them, because
                    they will be able to see their results straight away.
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <Button size="sm" disabled={claim.isPending} onClick={() => void add(s.id)}>
                      Yes, this is my child
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setConfirming(null)}>
                      No, go back
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
