import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { TERMS_TEXT } from "@/lib/event-config";

type Props = {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
};

export function TermsPanel({ checked, onCheckedChange }: Props) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Rules & expectations</Label>
      <ScrollArea className="h-56 rounded-md border bg-muted/30 p-4">
        <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-foreground">
          {TERMS_TEXT}
        </pre>
      </ScrollArea>
      <label className="flex items-start gap-3 p-3 rounded-md border bg-white cursor-pointer">
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => onCheckedChange(v === true)}
          className="mt-0.5"
        />
        <span className="text-sm leading-snug">
          I have read and agree to the rules above on behalf of my swimmer.
        </span>
      </label>
    </div>
  );
}
