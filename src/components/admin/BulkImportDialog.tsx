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
import { getOrCreateVendor, uploadProductImage } from "@/lib/products";

const CSV_COLUMNS = [
  "product_id",
  "display_name",
  "product_name",
  "brand",
  "vendor",
  "size",
  "colours",
  "category",
  "subcategory",
  "material",
  "dimensions",
  "packaging",
  "original_price",
  "discounted_price",
  "price_per_unit",
  "gst_rate",
  "stock_status",
  "video_url",
  "image_filenames",
] as const;

type CsvCol = (typeof CSV_COLUMNS)[number];

const STOCK_VALUES = new Set(["in_stock", "out_of_stock", "preorder"]);

type ParsedRow = {
  index: number;
  data: Record<CsvCol, string>;
  errors: string[];
  imageStatus: "all" | "partial" | "missing" | "none";
};

type ImportResult = {
  successes: number;
  failures: { row: number; name: string; error: string }[];
};

interface BulkImportDialogProps {
  onImported: () => void;
}

const TEMPLATE_CSV = CSV_COLUMNS.join(",") + "\n";

function splitList(value: string): string[] {
  return value
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function BulkImportDialog({ onImported }: BulkImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [zipImages, setZipImages] = useState<Map<string, JSZip.JSZipObject>>(new Map());
  const [parsing, setParsing] = useState(false);
  const [pdfParsing, setPdfParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const pdfProcessorUrl = import.meta.env.VITE_PDF_PROCESSOR_URL;

  const stats = useMemo(() => {
    const valid = rows.filter((r) => r.errors.length === 0).length;
    const invalid = rows.length - valid;
    const matched = rows.filter((r) => r.imageStatus === "all").length;
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
        const imageStatus = computeImageStatus(data.image_filenames, imgMap);
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
        imageStatus: computeImageStatus(r.data.image_filenames, imgMap),
      })),
    );
  }

  async function handlePdfChange(file: File | null) {
    setPdfFile(file);
    setCsvFile(null);
    setRows([]);
    setResult(null);
    if (!file) return;
    setPdfParsing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${pdfProcessorUrl}/process-pdf`, {
        method: "POST",
        body: formData,
      });
      const text = await response.text();
      if (!response.ok) {
        let message = text;
        try {
          const json = JSON.parse(text);
          message = json.detail || json.error || text;
        } catch {
          message = text || "Failed to parse PDF";
        }
        throw new Error(message);
      }

      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Invalid JSON response from PDF processor: ${text}`);
      }

      const parsedRows = Array.isArray(data.rows) ? data.rows : [];
      const next: ParsedRow[] = parsedRows.map((row, index) => {
        const displayName = (row.name || row.display_name || "").trim();
        const colours = Array.isArray(row.colours)
          ? row.colours.join("|")
          : String(row.colours || "");

        const imageRef = String(row.actual_image_path || row.image_reference || "");
        const data: Record<CsvCol, string> = {
          product_id: String(row.product_id || ""),
          display_name: displayName,
          product_name: String(row.product_name || ""),
          brand: String(row.brand || ""),
          vendor: String(row.vendor || ""),
          size: String(row.size || ""),
          colours,
          category: String(row.category || ""),
          subcategory: String(row.subcategory || ""),
          material: String(row.material || ""),
          dimensions: String(row.dimensions || ""),
          packaging: String(row.packaging || ""),
          original_price: String(row.original_price || ""),
          discounted_price: String(row.discounted_price || ""),
          price_per_unit: String(row.price_per_unit || ""),
          gst_rate: String(row.gst_rate || ""),
          stock_status: String(row.stock_status || ""),
          video_url: String(row.video_url || ""),
          image_filenames: imageRef,
        };

        return {
          index: index + 1,
          data,
          errors: validateRow(data),
          imageStatus: computeImageStatus(data.image_filenames, zipImages),
        };
      });
      setRows(next);
      if (next.length > 0) {
        toast.success(`PDF parsed ${next.length} rows`);
      } else {
        toast.error("PDF parsed but returned no rows.");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to parse PDF");
      setPdfFile(null);
    } finally {
      setPdfParsing(false);
    }
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
        const d = row.data;
        const vendor_id = d.vendor ? await getOrCreateVendor(d.vendor) : null;

        const filenames = splitList(d.image_filenames).map((n) => n.toLowerCase());
        const urls: string[] = [];
        for (const fn of filenames) {
          const entry = zipImages.get(fn);
          if (!entry) continue;
          const blob = await entry.async("blob");
          urls.push(await uploadProductImage(blob, fn));
        }

        const { data: inserted, error } = await supabase
          .from("products")
          .insert({
            name: d.display_name,
            display_name: d.display_name,
            product_name: d.product_name || null,
            product_id: d.product_id || null,
            brand: d.brand || null,
            vendor_id,
            size: d.size || null,
            category: d.category || null,
            subcategory: d.subcategory || null,
            material: d.material || null,
            dimensions: d.dimensions || null,
            packaging: d.packaging || null,
            original_price: d.original_price ? Number(d.original_price) : null,
            discounted_price: d.discounted_price ? Number(d.discounted_price) : null,
            price_per_unit: d.price_per_unit ? Number(d.price_per_unit) : null,
            gst_rate: d.gst_rate ? Number(d.gst_rate) : null,
            stock_status: (d.stock_status || "in_stock") as any,
            video_url: d.video_url || null,
          })
          .select("id")
          .single();
        if (error) throw error;
        const pid = inserted.id;

        if (urls.length > 0) {
          const imgRows = urls.map((url, idx) => ({
            product_id: pid,
            url,
            position: idx,
            is_primary: idx === 0,
          }));
          const { error: iErr } = await supabase.from("product_images").insert(imgRows);
          if (iErr) throw iErr;
        }

        const colours = splitList(d.colours);
        if (colours.length > 0) {
          const { error: cErr } = await supabase
            .from("product_colours")
            .insert(colours.map((c) => ({ product_id: pid, colour: c })));
          if (cErr) throw cErr;
        }

        successes++;
      } catch (err: any) {
        failures.push({
          row: row.index,
          name: row.data.display_name || "(no name)",
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
              Upload a CSV and an optional ZIP of images, or upload a PDF for structured product extraction.
              Use <code>|</code> to separate multiple colours or image filenames (first image is primary). Stock status must be{" "}
              <code>in_stock</code>, <code>out_of_stock</code>, or <code>preorder</code>.
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
                      disabled={importing || pdfParsing}
                      onChange={(e) => handleCsvChange(e.target.files?.[0] ?? null)}
                    />
                    {csvFile && <p className="truncate text-xs text-muted-foreground">{csvFile.name}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pdf-file">PDF file *</Label>
                    <Input
                      id="pdf-file"
                      type="file"
                      accept="application/pdf"
                      disabled={importing || parsing}
                      onChange={(e) => handlePdfChange(e.target.files?.[0] ?? null)}
                    />
                    {pdfFile && (
                      <p className="truncate text-xs text-muted-foreground">{pdfFile.name}</p>
                    )}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
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

                {(parsing || pdfParsing) && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {pdfParsing ? "Parsing PDF…" : "Parsing CSV…"}
                  </div>
                )}

                {rows.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium">Preview ({rows.length} row{rows.length === 1 ? "" : "s"})</h3>
                      <p className="text-xs text-muted-foreground">
                        {stats.valid} valid · {stats.invalid} invalid · {stats.matched} fully matched
                      </p>
                    </div>
                    <div className="max-h-72 overflow-auto rounded-md border">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background">
                          <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead>Display name</TableHead>
                            <TableHead>Brand</TableHead>
                            <TableHead>Vendor</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Images</TableHead>
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
                                  {r.data.display_name || <span className="text-muted-foreground">—</span>}
                                </TableCell>
                                <TableCell className="max-w-28 truncate text-sm">{r.data.brand || "—"}</TableCell>
                                <TableCell className="max-w-28 truncate text-sm">{r.data.vendor || "—"}</TableCell>
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
                      ? `${stats.valid} valid · ${stats.invalid} invalid · ${stats.matched} fully matched`
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
  if (status === "all") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-500">
        <CheckCircle2 className="h-3.5 w-3.5" />
        All found
      </span>
    );
  }
  if (status === "partial") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-500">
        <AlertCircle className="h-3.5 w-3.5" />
        Partial
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
  if (!data.display_name) errors.push("display_name is required");
  const orig = parseMaybeNum(data.original_price);
  const disc = parseMaybeNum(data.discounted_price);
  const ppu = parseMaybeNum(data.price_per_unit);
  const gst = parseMaybeNum(data.gst_rate);
  if (orig === "invalid") errors.push("Invalid original_price");
  if (disc === "invalid") errors.push("Invalid discounted_price");
  if (ppu === "invalid") errors.push("Invalid price_per_unit");
  if (gst === "invalid") errors.push("Invalid gst_rate");
  if (typeof gst === "number" && gst > 100) errors.push("gst_rate must be 0–100");
  if (typeof orig === "number" && typeof disc === "number" && disc > orig) {
    errors.push("Discounted exceeds original");
  }
  if (data.stock_status && !STOCK_VALUES.has(data.stock_status)) {
    errors.push("stock_status must be in_stock | out_of_stock | preorder");
  }
  return errors;
}

function parseMaybeNum(value: string): number | null | "invalid" {
  if (!value) return null;
  const n = Number(value);
  if (Number.isNaN(n) || n < 0) return "invalid";
  return n;
}

function computeImageStatus(
  filenames: string,
  imgMap: Map<string, JSZip.JSZipObject>,
): ParsedRow["imageStatus"] {
  const list = splitList(filenames).map((n) => n.toLowerCase());
  if (list.length === 0) return "none";
  const found = list.filter((n) => imgMap.has(n)).length;
  if (found === list.length) return "all";
  if (found === 0) return "missing";
  return "partial";
}
