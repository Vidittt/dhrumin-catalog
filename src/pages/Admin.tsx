import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Trash2, Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Product } from "@/types/product";

type FormState = {
  name: string;
  brand: string;
  size: string;
  colour: string;
  category: string;
};

const emptyForm: FormState = { name: "", brand: "", size: "", colour: "", category: "" };

const Admin = () => {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    document.title = "Admin — Add product";
    fetchProducts();
  }, []);

  async function fetchProducts() {
    const { data } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setProducts(data as Product[]);
  }

  const suggestions = useMemo(() => {
const acc = { brand: new Set<string>(), size: new Set<string>(), colour: new Set<string>(), category: new Set<string>() };
    for (const p of products) {
      if (p.brand) acc.brand.add(p.brand);
      if (p.size) acc.size.add(p.size);
      if (p.colour) acc.colour.add(p.colour);
      if (p.category) acc.category.add(p.category);
    }
    return {
      brand: [...acc.brand],
      size: [...acc.size],
      colour: [...acc.colour],
      category: [...acc.category],
    };
  }, [products]);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSubmitting(true);
    try {
      let image_url: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("product-images")
          .upload(path, file, { contentType: file.type });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
        image_url = pub.publicUrl;
      }

      const { error } = await supabase.from("products").insert({
        name: form.name.trim(),
        brand: form.brand.trim() || null,
        size: form.size.trim() || null,
        colour: form.colour.trim() || null,
        category: form.category.trim() || null,
        image_url,
      });
      if (error) throw error;

      toast.success("Product added");
      setForm(emptyForm);
      setFile(null);
      const fileInput = document.getElementById("image") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
      fetchProducts();
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
    fetchProducts();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 md:px-6">
          <h1 className="text-lg font-semibold tracking-tight md:text-xl">Admin · Add product</h1>
          <Button asChild variant="ghost" size="sm">
            <Link to="/">View storefront</Link>
          </Button>
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
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="Enter product name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="image">Image</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                {file && (
                  <p className="text-xs text-muted-foreground">
                    <Upload className="mr-1 inline h-3 w-3" />
                    {file.name}
                  </p>
                )}
              </div>

              {(["brand", "size", "colour", "category"] as const).map((key) => (
                <div className="space-y-2" key={key}>
                  <Label htmlFor={key} className="capitalize">{key}</Label>
                  <Input
                    id={key}
                    list={`${key}-suggestions`}
                    value={form[key]}
                    onChange={(e) => update(key, e.target.value)}
                    placeholder={`e.g. ${defaultPlaceholders[key]}`}
                  />
                  <datalist id={`${key}-suggestions`}>
                    {suggestions[key].map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>
              ))}

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
                {products.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 rounded-md border p-2">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-muted">
                      {p.image_url && (
                        <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[p.brand, p.category].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(p)}
                      aria-label={`Delete ${p.name}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const defaultPlaceholders: Record<"brand" | "size" | "colour" | "category", string> = {
  brand: "American Tourister",
  size: "Cabin",
  colour: "Black",
  category: "Trolley",
};

export default Admin;
