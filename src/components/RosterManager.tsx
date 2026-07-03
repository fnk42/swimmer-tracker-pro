import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAddSwimmer, useImportSwimmers } from "@/lib/api";
import { parseSwimmersCsv, CSV_TEMPLATE, downloadCsv, type ParsedCsv } from "@/lib/csv";
import { toast } from "sonner";
import { Upload, Plus, FileDown } from "lucide-react";

export function RosterManager() {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<"Male" | "Female" | "">("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ParsedCsv | null>(null);
  const addMut = useAddSwimmer();
  const importMut = useImportSwimmers();

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await addMut.mutateAsync({
        name: name.trim(),
        age: age ? parseInt(age, 10) : undefined,
        gender: gender || undefined,
      });
      setName("");
      setAge("");
      setGender("");
      toast.success("Swimmer added");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to add swimmer.";
      toast.error(msg);
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const parsed = parseSwimmersCsv(text);
      setPreview(parsed);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function confirmImport() {
    if (!preview) return;
    try {
      const result = await importMut.mutateAsync(preview.valid);
      setPreview(null);
      toast.success(
        `Imported ${result.imported.length} swimmer${result.imported.length === 1 ? "" : "s"}` +
          (result.skipped.length ? `, skipped ${result.skipped.length}` : ""),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to import.";
      toast.error(msg);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-[1fr_100px_140px_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="add-name" className="text-xs">
            Full name
          </Label>
          <Input
            id="add-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Aisha Kariuki"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="add-age" className="text-xs">
            Age
          </Label>
          <Input
            id="add-age"
            type="number"
            min={4}
            max={25}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="12"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Gender</Label>
          <Select value={gender} onValueChange={(v) => setGender(v as "Male" | "Female")}>
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Male">Male</SelectItem>
              <SelectItem value="Female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button type="submit" className="w-full sm:w-auto" disabled={addMut.isPending}>
            <Plus className="h-4 w-4" /> {addMut.isPending ? "Adding…" : "Add swimmer"}
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2 items-center pt-2 border-t">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFile}
        />
        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" /> Upload CSV
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => downloadCsv("swimmers-template.csv", CSV_TEMPLATE)}
        >
          <FileDown className="h-4 w-4" /> Download template
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">
          Columns: name (required), age, gender
        </span>
      </div>

      <Dialog open={preview !== null} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import preview</DialogTitle>
            <DialogDescription>
              Review before importing. Duplicates and invalid rows are skipped.
            </DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="space-y-4 text-sm">
              <div className="flex gap-4">
                <div className="flex-1 rounded-md border p-3">
                  <div className="text-2xl font-semibold text-emerald-600">
                    {preview.valid.length}
                  </div>
                  <div className="text-xs text-muted-foreground">Valid rows</div>
                </div>
                <div className="flex-1 rounded-md border p-3">
                  <div className="text-2xl font-semibold text-amber-600">
                    {preview.invalid.length}
                  </div>
                  <div className="text-xs text-muted-foreground">Skipped</div>
                </div>
              </div>
              {preview.invalid.length > 0 && (
                <div className="rounded-md border bg-amber-50/50 p-3 max-h-40 overflow-y-auto">
                  <div className="text-xs font-medium mb-2">Skipped rows</div>
                  <ul className="space-y-1 text-xs">
                    {preview.invalid.map((r, i) => (
                      <li key={i} className="text-muted-foreground">
                        Row {r.row} — <span className="text-foreground">{r.name || "(blank)"}</span>: {r.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {preview.valid.length > 0 && (
                <div className="rounded-md border p-3 max-h-40 overflow-y-auto">
                  <div className="text-xs font-medium mb-2">Will be imported</div>
                  <ul className="space-y-1 text-xs">
                    {preview.valid.map((r, i) => (
                      <li key={i}>
                        {r.name}
                        {r.age ? `, age ${r.age}` : ""}
                        {r.gender ? `, ${r.gender}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPreview(null)}>
              Cancel
            </Button>
            <Button
              onClick={confirmImport}
              disabled={!preview || preview.valid.length === 0 || importMut.isPending}
            >
              {importMut.isPending
                ? "Importing…"
                : `Import ${preview?.valid.length ?? 0} swimmer${(preview?.valid.length ?? 0) === 1 ? "" : "s"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
