import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { FilterPanel, type Filters, type FacetKey } from "@/components/storefront/FilterPanel";
import { ProductCard } from "@/components/storefront/ProductCard";
import type { Product } from "@/types/product";
import { fetchProductsWithRelations } from "@/lib/products";

const emptyFilters: Filters = {
  brand: [],
  size: [],
  colour: [],
  category: [],
  subcategory: [],
  material: [],
  vendor: [],
  stock_status: [],
};

const FACET_KEYS: FacetKey[] = [
  "brand",
  "size",
  "colour",
  "category",
  "subcategory",
  "material",
  "vendor",
  "stock_status",
];

const Index = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(emptyFilters);

  useEffect(() => {
    document.title = "Storefront — Browse products";
    const meta = document.querySelector('meta[name="description"]');
    if (meta)
      meta.setAttribute(
        "content",
        "Search and filter our product catalog by brand, size, colour, vendor, stock and more."
      );
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchProductsWithRelations();
      setProducts(data);
    } finally {
      setLoading(false);
    }
  }

  const facets = useMemo(() => {
    const f: Record<FacetKey, Set<string>> = {
      brand: new Set(),
      size: new Set(),
      colour: new Set(),
      category: new Set(),
      subcategory: new Set(),
      material: new Set(),
      vendor: new Set(),
      stock_status: new Set(),
    };
    for (const p of products) {
      if (p.brand) f.brand.add(p.brand);
      if (p.size) f.size.add(p.size);
      for (const c of p.colours) f.colour.add(c);
      if (p.category) f.category.add(p.category);
      if (p.subcategory) f.subcategory.add(p.subcategory);
      if (p.material) f.material.add(p.material);
      if (p.vendor?.name) f.vendor.add(p.vendor.name);
      f.stock_status.add(p.stock_status);
    }
    return Object.fromEntries(FACET_KEYS.map((k) => [k, [...f[k]].sort()])) as Record<FacetKey, string[]>;
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (q) {
        const hay = `${p.display_name} ${p.name} ${p.brand ?? ""} ${p.product_id ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      for (const key of ["brand", "size", "category", "subcategory", "material"] as const) {
        const sel = filters[key];
        if (sel.length && !(p[key] && sel.includes(p[key] as string))) return false;
      }
      if (filters.colour.length && !p.colours.some((c) => filters.colour.includes(c))) return false;
      if (filters.vendor.length && !(p.vendor?.name && filters.vendor.includes(p.vendor.name))) return false;
      if (filters.stock_status.length && !filters.stock_status.includes(p.stock_status)) return false;
      return true;
    });
  }, [products, search, filters]);

  const activeCount = FACET_KEYS.reduce((n, k) => n + filters[k].length, 0);

  function clearAll() {
    setFilters(emptyFilters);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 md:px-6">
          <h1 className="shrink-0 text-lg font-semibold tracking-tight md:text-xl">Storefront</h1>
          <div className="relative ml-auto w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="pl-9"
              aria-label="Search products"
            />
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden" aria-label="Open filters">
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <FilterPanel facets={facets} filters={filters} onChange={setFilters} onClear={clearAll} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 md:px-6">
        <aside className="hidden w-64 shrink-0 md:block">
          <div className="sticky top-20">
            <FilterPanel facets={facets} filters={filters} onChange={setFilters} onClear={clearAll} />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground">
              {loading ? "Loading..." : `${filtered.length} product${filtered.length === 1 ? "" : "s"}`}
            </p>
            {activeCount > 0 && (
              <>
                <Badge variant="secondary">{activeCount} filter{activeCount === 1 ? "" : "s"}</Badge>
                <Button variant="ghost" size="sm" onClick={clearAll} className="h-7 px-2">
                  <X className="mr-1 h-3 w-3" /> Clear
                </Button>
              </>
            )}
          </div>

          {!loading && filtered.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-base font-medium">No products match</p>
                <p className="mt-1 text-sm text-muted-foreground">Try adjusting your search or filters.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Index;
