import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

// "Something to say about this page?" — on every page, for everyone signed in.
//
// The route is captured with the note. Feedback that arrives as "the filter is
// confusing" costs a round trip to place; the same words with the page attached
// can be acted on. Parents can only write; the notes land on the coordinators'
// roadmap board.

export function NoteButton() {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    try {
      const route =
        typeof window === "undefined" ? "" : window.location.pathname + window.location.hash;
      const r = await fetch("/api/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: text, route }),
      });
      if (r.status === 401) {
        toast.error("Sign in first and your note will reach the coordinators.");
        return;
      }
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(d.error ?? "Could not send that note.");
        return;
      }
      toast.success("Sent. Thank you — it arrives with the page attached.");
      setBody("");
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Leave a note about this page"
        className="fixed bottom-4 right-4 z-50 flex h-11 items-center gap-2 rounded-full
                   border border-border bg-card px-4 text-[13px] font-medium text-muted-foreground
                   shadow-lg transition hover:text-foreground
                   focus-visible:outline-2 focus-visible:outline-[color:var(--ng-electric)]"
      >
        <span aria-hidden>💬</span>
        <span className="hidden sm:inline">Note</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Something about this page?</DialogTitle>
            <DialogDescription>
              Anything at all — confusing wording, a number that looks wrong, something you
              wish were here. It goes straight to the coordinators with this page attached.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            autoFocus
            placeholder="What would make this better?"
          />
          <div className="flex items-center gap-2">
            <Button disabled={!body.trim() || busy} onClick={send}>
              {busy ? "Sending…" : "Send"}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
