import { useMemo, useState } from "react";
import Papa from "papaparse";
import JSZip from "jszip";
import { toast } from "sonner";
import { Download, Loader2, Upload, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const CSV_COLUMNS = [
  "name",
  "brand",
  "size",
  "colour",
  "category",
  "subcategory",
  "material",
  "dimensions",
  "original_price",
  "discounted_price",
  "image_filename",
] as const;

type CsvCol = (typeof CSV_COLUMNS)[number];

type ParsedRow = {
  index: number;
  data: Record<CsvCol, string>;
  errors: string[];
  imageStatus: "found" | "missing" | "none";
};

type ImportResult = {
  successes: number;
  failures: { row: number; name: string; error: string }[];
};

interface BulkImportDialogProps {
  onImported: () => void;
}

const TEMPLATE_CSV = CSV_COLUMNS.join(",") + "\n";

export function BulkImportDialog({ onImported }: BulkImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [zipImages, setZipImages] = useState<Map<string, JSZip.JSZipObject>>(new Map());
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  const stats = useMemo(() => {
    const valid = rows.filter((r) => r.errors.length === 0).length;
    const invalid = rows.length - valid;
    const matched = rows.filter((r) => r.imageStatus === "found").length;
    return { valid, invalid, matched };
  }, [rows]);

  function reset() {
    setCsvFile(null);
    setZipFile(null);
    setRows([]);
    setZipImages(new Map());
    setProgress(0);
    setResult(null);
  }

  function handleOpenChange(next: boolean) {
    if (importing) return;
    setOpen(next);
    if (!next) {
      reset();
      if (result && result.successes > 0) onImported();
    }
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "products-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCsvChange(file: File | null) {
    setCsvFile(file);
    setRows([]);
    setResult(null);
    if (!file) return;
    setParsing(true);
    try {
      const text = await file.text();
      const parsed = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim().toLowerCase(),
      });
      const imgMap = zipImages;
      const next: ParsedRow[] = parsed.data.map((raw, i) => {
        const data = {} as Record<CsvCol, string>;
        for (const col of CSV_COLUMNS) data[col] = (raw[col] ?? "").trim();
        const errors = validateRow(data);
        const imageStatus = computeImageStatus(data.image_filename, imgMap);
        return { index: i + 2, data, errors, imageStatus };
      });
      setRows(next);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to parse CSV");
    } finally {
      setParsing(false);
    }
  }

  async function handleZipChange(file: File | null) {
    setZipFile(file);
    setResult(null);
    let imgMap = new Map<string, JSZip.JSZipObject>();
    if (file) {
      try {
        const zip = await JSZip.loadAsync(file);
        zip.forEach((path, entry) => {
          if (entry.dir) return;
          const base = path.split("/").pop()?.toLowerCase();
          if (base) imgMap.set(base, entry);
        });
      } catch (err: any) {
        toast.error(err?.message ?? "Failed to read ZIP");
        imgMap = new Map();
      }
    }
    setZipImages(imgMap);
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        imageStatus: computeImageStatus(r.data.image_filename, imgMap),
      })),
    );
  }

  async function handleImport() {
    const valid = rows.filter((r) => r.errors.length === 0);
    if (valid.length === 0) {
      toast.error("No valid rows to import");
      return;
    }
    setImporting(true);
    setProgress(0);
    const failures: ImportResult["failures"] = [];
    let successes = 0;

    for (let i = 0; i < valid.length; i++) {
      const row = valid[i];
      try {
        let image_url: string | null = null;
        const filename = row.data.image_filename.toLowerCase();
        if (filename && zipImages.has(filename)) {
          const entry = zipImages.get(filename)!;
          const blob = await entry.async("blob");
          const ext = filename.split(".").pop() || "jpg";
          const path = `${crypto.randomUUID()}.${ext}`;
          const contentType = guessMime(ext);
          const { error: upErr } = await supabase.storage
            .from("product-images")
            .upload(path, blob, { contentType });
          if (upErr) throw upErr;
          const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
          image_url = pub.publicUrl;
        }

        const { error } = await supabase.from("products").insert({
          name: row.data.name,
          brand: row.data.brand || null,
          size: row.data.size || null,
          colour: row.data.colour || null,
          category: row.data.category || null,
          subcategory: row.data.subcategory || null,
          material: row.data.material || null,
          dimensions: row.data.dimensions || null,
          original_price: row.data.original_price ? Number(row.data.original_price) : null,
          discounted_price: row.data.discounted_price ? Number(row.data.discounted_price) : null,
          image_url,
        } as any);
        if (error) throw error;
        successes++;
      } catch (err: any) {
        failures.push({
          row: row.index,
          name: row.data.name || "(no name)",
          error: err?.message ?? "Unknown error",
        });
      } finally {
        setProgress(i + 1);
      }
    }

    setImporting(false);
    setResult({ successes, failures });
    if (successes > 0) toast.success(`Imported ${successes} product${successes === 1 ? "" : "s"}`);
    if (failures.length > 0) toast.error(`${failures.length} row${failures.length === 1 ? "" : "s"} failed`);
  }

  const validCount = stats.valid;
  const totalToImport = validCount;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4" />
          Bulk import
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[90vh] max-w-3xl overflow-hidden p-0"
        onInteractOutside={(e) => importing && e.preventDefault()}
        onEscapeKeyDown={(e) => importing && e.preventDefault()}
      >
        <div className="flex max-h-[90vh] flex-col">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>Bulk import products</DialogTitle>
            <DialogDescription>
              Upload a CSV of products and an optional ZIP of images. Filenames in the CSV are matched
              case-insensitively to images in the ZIP.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {!result && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 p-3">
                  <div className="text-sm text-muted-foreground">
                    Need a starting point? Download the CSV template with all supported columns.
                  </div>
                  <Button type="button" variant="secondary" size="sm" onClick={downloadTemplate}>
                    <Download className="h-4 w-4" />
                    Download template
                  </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="csv-file">CSV file *</Label>
                    <Input
                      id="csv-file"
                      type="file"
                      accept=".csv,text/csv"
                      disabled={importing}
                      onChange={(e) => handleCsvChange(e.target.files?.[0] ?? null)}
                    />
                    {csvFile && (
                      <p className="truncate text-xs text-muted-foreground">{csvFile.name}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zip-file">Images ZIP (optional)</Label>
                    <Input
                      id="zip-file"
                      type="file"
                      accept=".zip,application/zip,application/x-zip-compressed"
                      disabled={importing}
                      onChange={(e) => handleZipChange(e.target.files?.[0] ?? null)}
                    />
                    {zipFile && (
                      <p className="truncate text-xs text-muted-foreground">
                        {zipFile.name} · {zipImages.size} image{zipImages.size === 1 ? "" : "s"}
                      </p>
                    )}
                  </div>
                </div>

                {parsing && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Parsing CSV…
                  </div>
                )}

                {rows.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium">Preview ({rows.length} row{rows.length === 1 ? "" : "s"})</h3>
                      <p className="text-xs text-muted-foreground">
                        {stats.valid} valid · {stats.invalid} invalid · {stats.matched} image
                        {stats.matched === 1 ? "" : "s"} matched
                      </p>
                    </div>
                    <div className="max-h-72 overflow-auto rounded-md border">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background">
                          <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Brand</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Image</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((r) => {
                            const invalid = r.errors.length > 0;
                            return (
                              <TableRow
                                key={r.index}
                                className={cn(invalid && "bg-destructive/10 hover:bg-destructive/15")}
                              >
                                <TableCell className="text-xs text-muted-foreground">{r.index}</TableCell>
                                <TableCell className="max-w-40 truncate text-sm">
                                  {r.data.name || <span className="text-muted-foreground">—</span>}
                                </TableCell>
                                <TableCell className="max-w-28 truncate text-sm">{r.data.brand || "—"}</TableCell>
                                <TableCell className="max-w-28 truncate text-sm">{r.data.category || "—"}</TableCell>
                                <TableCell className="text-sm tabular-nums">
                                  {r.data.discounted_price || r.data.original_price || "—"}
                                </TableCell>
                                <TableCell>
                                  <ImageBadge status={r.imageStatus} />
                                </TableCell>
                                <TableCell>
                                  {invalid ? (
                                    <span
                                      className="inline-flex items-center gap-1 text-xs text-destructive"
                                      title={r.errors.join("; ")}
                                    >
                                      <XCircle className="h-3.5 w-3.5" />
                                      {r.errors[0]}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                      Ready
                                    </span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </>
            )}

            {result && (
              <div className="space-y-4">
                <div className="rounded-md border p-4">
                  <h3 className="text-sm font-medium">Import complete</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {result.successes} imported · {result.failures.length} failed
                  </p>
                </div>
                {result.failures.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Failed rows</h4>
                    <div className="max-h-60 overflow-auto rounded-md border">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background">
                          <TableRow>
                            <TableHead className="w-12">Row</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Error</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {result.failures.map((f, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs text-muted-foreground">{f.row}</TableCell>
                              <TableCell className="text-sm">{f.name}</TableCell>
                              <TableCell className="text-xs text-destructive">{f.error}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="border-t px-6 py-4 sm:justify-between">
            {!result ? (
              <>
                <p className="text-xs text-muted-foreground">
                  {importing
                    ? `Importing ${progress} / ${totalToImport}…`
                    : rows.length > 0
                      ? `${stats.valid} valid · ${stats.invalid} invalid · ${stats.matched} image${stats.matched === 1 ? "" : "s"} matched`
                      : "Pick a CSV to begin"}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleOpenChange(false)}
                    disabled={importing}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleImport}
                    disabled={importing || validCount === 0}
                  >
                    {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                    {importing
                      ? `Importing ${progress} / ${totalToImport}…`
                      : `Import ${validCount} product${validCount === 1 ? "" : "s"}`}
                  </Button>
                </div>
              </>
            ) : (
              <div className="ml-auto">
                <Button type="button" onClick={() => handleOpenChange(false)}>
                  Close
                </Button>
              </div>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ImageBadge({ status }: { status: ParsedRow["imageStatus"] }) {
  if (status === "found") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-500">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Found
      </span>
    );
  }
  if (status === "missing") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-500">
        <AlertCircle className="h-3.5 w-3.5" />
        Missing
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">—</span>;
}

function validateRow(data: Record<CsvCol, string>): string[] {
  const errors: string[] = [];
  if (!data.name) errors.push("Name is required");
  const orig = parseMaybePrice(data.original_price);
  const disc = parseMaybePrice(data.discounted_price);
  if (orig === "invalid") errors.push("Invalid original_price");
  if (disc === "invalid") errors.push("Invalid discounted_price");
  if (typeof orig === "number" && typeof disc === "number" && disc > orig) {
    errors.push("Discounted exceeds original");
  }
  return errors;
}

function parseMaybePrice(value: string): number | null | "invalid" {
  if (!value) return null;
  const n = Number(value);
  if (Number.isNaN(n) || n < 0) return "invalid";
  return n;
}

function computeImageStatus(
  filename: string,
  imgMap: Map<string, JSZip.JSZipObject>,
): ParsedRow["imageStatus"] {
  const f = filename?.toLowerCase().trim();
  if (!f) return "none";
  return imgMap.has(f) ? "found" : "missing";
}

function guessMime(ext: string): string {
  const e = ext.toLowerCase();
  if (e === "jpg" || e === "jpeg") return "image/jpeg";
  if (e === "png") return "image/png";
  if (e === "webp") return "image/webp";
  if (e === "gif") return "image/gif";
  return "application/octet-stream";
}
