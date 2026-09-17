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
export function FindSwimmer({ onClaimed }: { onClaimed?: () => void }) {
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [error, setError] = useState<string | null>(null);
  const results = useClaimable(debounced);
  const claim = useClaimSwimmer();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term), 250);
    return () => clearTimeout(t);
  }, [term]);

  const found = results.data ?? [];
  const searching = debounced.trim().length >= 2;

  async function add(id: string) {
    setError(null);
    try {
      await claim.mutateAsync(id);
      setTerm("");
      setDebounced("");
      onClaimed?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add that swimmer.");
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search your child's name…"
          aria-label="Search for your swimmer by name"
          className="h-11"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Type at least two letters. Two adults can be on the same swimmer.
        </p>
      </div>

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      {searching && results.isLoading && (
        <p className="text-xs text-muted-foreground">Searching…</p>
      )}

      {searching && !results.isLoading && found.length === 0 && (
        <p className="rounded-lg bg-secondary px-3 py-2.5 text-xs text-muted-foreground">
          No swimmer matches that name, or the ones that do already have two adults on the
          record. Ask the coordinator if that is not right.
        </p>
      )}

      {found.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {found.map((s) => (
            <li key={s.id} className="flex items-center gap-3 bg-card px-3.5 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{s.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {s.mine
                    ? "Already on your record"
                    : s.adults === 0
                      ? "No adult linked yet"
                      : "One adult already linked · one place left"}
                </span>
              </span>
              <Button
                size="sm"
                variant={s.mine ? "outline" : "default"}
                disabled={s.mine || claim.isPending}
                onClick={() => add(s.id)}
              >
                {s.mine ? "Added" : "This is my child"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
