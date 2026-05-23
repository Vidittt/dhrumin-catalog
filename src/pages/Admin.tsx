import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Trash2, Upload, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BulkImportDialog } from "@/components/admin/BulkImportDialog";
import type { Product, StockStatus } from "@/types/product";
import { fetchProductsWithRelations, getOrCreateVendor, uploadProductImage } from "@/lib/products";

type FormState = {
  display_name: string;
  product_name: string;
  product_id: string;
  brand: string;
  vendor: string;
  size: string;
  category: string;
  subcategory: string;
  material: string;
  dimensions: string;
  packaging: string;
  original_price: string;
  discounted_price: string;
  price_per_unit: string;
  gst_rate: string;
  stock_status: StockStatus;
  video_url: string;
};

const emptyForm: FormState = {
  display_name: "",
  product_name: "",
  product_id: "",
  brand: "",
  vendor: "",
  size: "",
  category: "",
  subcategory: "",
  material: "",
  dimensions: "",
  packaging: "",
  original_price: "",
  discounted_price: "",
  price_per_unit: "",
  gst_rate: "",
  stock_status: "in_stock",
  video_url: "",
};

type SuggestKey = "brand" | "vendor" | "size" | "category" | "subcategory" | "material" | "packaging";

const Admin = () => {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [files, setFiles] = useState<File[]>([]);
  const [colours, setColours] = useState<string[]>([]);
  const [colourInput, setColourInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    document.title = "Admin — Add product";
    refresh();
  }, []);

  async function refresh() {
    try {
      const data = await fetchProductsWithRelations(20);
      setProducts(data);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load");
    }
  }

  const suggestions = useMemo(() => {
    const acc: Record<SuggestKey, Set<string>> = {
      brand: new Set(),
      vendor: new Set(),
      size: new Set(),
      category: new Set(),
      subcategory: new Set(),
      material: new Set(),
      packaging: new Set(),
    };
    for (const p of products) {
      if (p.brand) acc.brand.add(p.brand);
      if (p.vendor?.name) acc.vendor.add(p.vendor.name);
      if (p.size) acc.size.add(p.size);
      if (p.category) acc.category.add(p.category);
      if (p.subcategory) acc.subcategory.add(p.subcategory);
      if (p.material) acc.material.add(p.material);
      if (p.packaging) acc.packaging.add(p.packaging);
    }
    return Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, [...v]])) as Record<SuggestKey, string[]>;
  }, [products]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function parseNum(value: string): number | null | "invalid" {
    const t = value.trim();
    if (!t) return null;
    const n = Number(t);
    if (Number.isNaN(n) || n < 0) return "invalid";
    return n;
  }

  function addColour(raw: string) {
    const v = raw.trim();
    if (!v) return;
    if (!colours.includes(v)) setColours((c) => [...c, v]);
    setColourInput("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.display_name.trim()) {
      toast.error("Display name is required");
      return;
    }
    const original = parseNum(form.original_price);
    const discounted = parseNum(form.discounted_price);
    const ppu = parseNum(form.price_per_unit);
    const gst = parseNum(form.gst_rate);
    if ([original, discounted, ppu, gst].includes("invalid" as any)) {
      toast.error("Numeric fields must be valid non-negative numbers");
      return;
    }
    if (typeof original === "number" && typeof discounted === "number" && discounted > original) {
      toast.error("Discounted price cannot exceed original price");
      return;
    }
    if (typeof gst === "number" && gst > 100) {
      toast.error("GST rate must be 0–100");
      return;
    }

    setSubmitting(true);
    try {
      const vendor_id = form.vendor.trim() ? await getOrCreateVendor(form.vendor) : null;

      const { data: inserted, error } = await supabase
        .from("products")
        .insert({
          name: form.display_name.trim(),
          display_name: form.display_name.trim(),
          product_name: form.product_name.trim() || null,
          product_id: form.product_id.trim() || null,
          brand: form.brand.trim() || null,
          vendor_id,
          size: form.size.trim() || null,
          category: form.category.trim() || null,
          subcategory: form.subcategory.trim() || null,
          material: form.material.trim() || null,
          dimensions: form.dimensions.trim() || null,
          packaging: form.packaging.trim() || null,
          original_price: original as number | null,
          discounted_price: discounted as number | null,
          price_per_unit: ppu as number | null,
          gst_rate: gst as number | null,
          stock_status: form.stock_status,
          video_url: form.video_url.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      const productId = inserted.id;

      if (files.length > 0) {
        const urls = await Promise.all(files.map((f) => uploadProductImage(f)));
        const rows = urls.map((url, i) => ({
          product_id: productId,
          url,
          position: i,
          is_primary: i === 0,
        }));
        const { error: imgErr } = await supabase.from("product_images").insert(rows);
        if (imgErr) throw imgErr;
      }

      if (colours.length > 0) {
        const { error: cErr } = await supabase
          .from("product_colours")
          .insert(colours.map((c) => ({ product_id: productId, colour: c })));
        if (cErr) throw cErr;
      }

      toast.success("Product added");
      setForm(emptyForm);
      setFiles([]);
      setColours([]);
      const fileInput = document.getElementById("images") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
      refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to add product");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(p: Product) {
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Product deleted");
    refresh();
  }

  const textFields: { key: SuggestKey | "product_name" | "product_id" | "dimensions" | "video_url"; label: string; placeholder: string; suggest?: SuggestKey }[] = [
    { key: "product_id", label: "Product ID", placeholder: "SKU-12345" },
    { key: "product_name", label: "Product name", placeholder: "Internal name" },
    { key: "brand", label: "Brand", placeholder: "American Tourister", suggest: "brand" },
    { key: "vendor", label: "Vendor", placeholder: "Acme Supplies", suggest: "vendor" },
    { key: "category", label: "Category", placeholder: "Trolley", suggest: "category" },
    { key: "subcategory", label: "Subcategory", placeholder: "Hardside", suggest: "subcategory" },
    { key: "size", label: "Size", placeholder: "Cabin", suggest: "size" },
    { key: "material", label: "Material", placeholder: "Polycarbonate", suggest: "material" },
    { key: "packaging", label: "Packaging", placeholder: "Box of 6", suggest: "packaging" },
    { key: "dimensions", label: "Dimensions", placeholder: "30 × 20 × 10 cm" },
    { key: "video_url", label: "Video URL", placeholder: "https://youtu.be/..." },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 md:px-6">
          <h1 className="text-lg font-semibold tracking-tight md:text-xl">Admin · Add product</h1>
          <div className="flex items-center gap-2">
            <BulkImportDialog onImported={refresh} />
            <Button asChild variant="ghost" size="sm">
              <Link to="/">View storefront</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 md:px-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New product</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="display_name">Display name *</Label>
                <Input
                  id="display_name"
                  value={form.display_name}
                  onChange={(e) => update("display_name", e.target.value)}
                  placeholder="Shown to customers"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="images">Images (one or more)</Label>
                <Input
                  id="images"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                />
                {files.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    <Upload className="mr-1 inline h-3 w-3" />
                    {files.length} file{files.length === 1 ? "" : "s"} · first is primary
                  </p>
                )}
              </div>

              {textFields.map((f) => (
                <div className="space-y-2" key={f.key}>
                  <Label htmlFor={f.key}>{f.label}</Label>
                  <Input
                    id={f.key}
                    list={f.suggest ? `${f.key}-suggestions` : undefined}
                    value={form[f.key as keyof FormState] as string}
                    onChange={(e) => update(f.key as keyof FormState, e.target.value as any)}
                    placeholder={f.placeholder}
                  />
                  {f.suggest && (
                    <datalist id={`${f.key}-suggestions`}>
                      {suggestions[f.suggest].map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  )}
                </div>
              ))}

              <div className="space-y-2">
                <Label htmlFor="colour-input">Colours</Label>
                <div className="flex gap-2">
                  <Input
                    id="colour-input"
                    value={colourInput}
                    onChange={(e) => setColourInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addColour(colourInput);
                      }
                    }}
                    placeholder="Type a colour and press Enter"
                  />
                  <Button type="button" variant="secondary" onClick={() => addColour(colourInput)}>
                    Add
                  </Button>
                </div>
                {colours.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {colours.map((c) => (
                      <Badge key={c} variant="outline" className="gap-1">
                        {c}
                        <button
                          type="button"
                          aria-label={`Remove ${c}`}
                          onClick={() => setColours((arr) => arr.filter((x) => x !== c))}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="stock_status">Stock status</Label>
                <Select
                  value={form.stock_status}
                  onValueChange={(v) => update("stock_status", v as StockStatus)}
                >
                  <SelectTrigger id="stock_status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_stock">In stock</SelectItem>
                    <SelectItem value="out_of_stock">Out of stock</SelectItem>
                    <SelectItem value="preorder">Pre-order</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ["original_price", "Original price"],
                    ["discounted_price", "Discounted price"],
                    ["price_per_unit", "Price / unit"],
                    ["gst_rate", "GST rate (%)"],
                  ] as const
                ).map(([key, label]) => (
                  <div className="space-y-2" key={key}>
                    <Label htmlFor={key}>{label}</Label>
                    <Input
                      id={key}
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={form[key]}
                      onChange={(e) => update(key, e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                ))}
              </div>

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? "Adding..." : "Add product"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent products</CardTitle>
          </CardHeader>
          <CardContent>
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground">No products yet.</p>
            ) : (
              <ul className="space-y-2">
                {products.map((p) => {
                  const img = p.images[0]?.url;
                  return (
                    <li key={p.id} className="flex items-center gap-3 rounded-md border p-2">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-muted">
                        {img && <img src={img} alt={p.display_name} className="h-full w-full object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.display_name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[p.brand, p.category, p.vendor?.name].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(p)}
                        aria-label={`Delete ${p.display_name}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Admin;
