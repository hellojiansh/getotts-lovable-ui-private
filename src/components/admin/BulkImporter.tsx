import { useState, useCallback, useRef } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Upload, FileSpreadsheet, FileJson, FileText, Check, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Row = Record<string, unknown>;

export function BulkImporter({
  label = "Bulk import",
  onCommit,
  templateHeaders,
}: {
  label?: string;
  /** TODO(codex): commit handler — POST rows to your VPS endpoint. */
  onCommit: (rows: Row[]) => Promise<{ inserted: number; updated: number }>;
  templateHeaders?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setRows([]); setFileName(""); setError(null); setBusy(false);
  };

  const parseFile = useCallback((file: File) => {
    setError(null); setFileName(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "csv") {
      Papa.parse<Row>(file, {
        header: true, skipEmptyLines: true,
        complete: (res) => {
          if (res.errors.length) setError(res.errors[0].message);
          setRows(res.data);
        },
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target?.result, { type: "binary" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          setRows(XLSX.utils.sheet_to_json<Row>(ws, { defval: "" }));
        } catch (err: any) { setError(err?.message ?? "Failed to parse XLSX"); }
      };
      reader.readAsBinaryString(file);
    } else if (ext === "json") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(String(e.target?.result));
          setRows(Array.isArray(parsed) ? parsed : [parsed]);
        } catch (err: any) { setError("Invalid JSON: " + err.message); }
      };
      reader.readAsText(file);
    } else {
      setError(`Unsupported file type: .${ext}`);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0]; if (f) parseFile(f);
  }, [parseFile]);

  const commit = async () => {
    setBusy(true);
    try {
      const res = await onCommit(rows);
      toast.success(`Imported ${res.inserted} new, ${res.updated} updated`);
      setOpen(false); reset();
    } catch (err: any) {
      toast.error(err?.message ?? "Import failed");
    } finally { setBusy(false); }
  };

  const headers = rows.length ? Object.keys(rows[0]) : [];

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5"><Upload className="h-4 w-4" /> {label}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk import</DialogTitle>
          <DialogDescription>Drop a CSV, XLSX or JSON file. Preview the rows, then commit.</DialogDescription>
        </DialogHeader>

        {!rows.length ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex-1 min-h-[260px] rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-center p-8 cursor-pointer transition",
              dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50",
            )}
          >
            <Upload className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-semibold">Drop a file here, or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">CSV, XLSX, JSON · up to 10 MB</p>
            <div className="mt-4 flex gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> CSV</span>
              <span className="inline-flex items-center gap-1"><FileSpreadsheet className="h-3.5 w-3.5" /> XLSX</span>
              <span className="inline-flex items-center gap-1"><FileJson className="h-3.5 w-3.5" /> JSON</span>
            </div>
            <input
              ref={inputRef} type="file" hidden
              accept=".csv,.xlsx,.xls,.json"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); }}
            />
            {templateHeaders && (
              <button
                type="button"
                className="mt-4 text-xs text-primary underline"
                onClick={(e) => {
                  e.stopPropagation();
                  const csv = templateHeaders.join(",") + "\n";
                  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
                  const a = document.createElement("a"); a.href = url; a.download = "template.csv"; a.click();
                }}
              >Download CSV template</button>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 px-1">
              <div className="text-sm min-w-0">
                <p className="font-semibold truncate">{fileName}</p>
                <p className="text-xs text-muted-foreground">{rows.length} rows · {headers.length} columns</p>
              </div>
              <Button variant="ghost" size="sm" onClick={reset}><X className="h-4 w-4 mr-1" /> Change file</Button>
            </div>
            {error && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 text-destructive text-xs p-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> <span>{error}</span>
              </div>
            )}
            <div className="flex-1 overflow-auto border rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>{headers.map((h) => <th key={h} className="text-left px-3 py-2 font-semibold">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t hover:bg-muted/40">
                      {headers.map((h) => <td key={h} className="px-3 py-1.5 truncate max-w-[180px]">{String(r[h] ?? "")}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 50 && <p className="text-center text-xs text-muted-foreground py-2">+{rows.length - 50} more rows…</p>}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={commit} disabled={busy} className="gap-1.5">
                <Check className="h-4 w-4" /> {busy ? "Importing…" : `Import ${rows.length} rows`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
