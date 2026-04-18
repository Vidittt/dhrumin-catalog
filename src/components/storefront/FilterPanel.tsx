import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export type FacetKey = "brand" | "size" | "colour" | "category" | "subcategory" | "material";
export type Filters = Record<FacetKey, string[]>;

type Props = {
  facets: Record<FacetKey, string[]>;
  filters: Filters;
  onChange: (next: Filters) => void;
  onClear: () => void;
};

const labels: Record<FacetKey, string> = {
  brand: "Brand",
  size: "Size",
  colour: "Colour",
  category: "Category",
  subcategory: "Subcategory",
  material: "Material",
};

export function FilterPanel({ facets, filters, onChange, onClear }: Props) {
  function toggle(key: FacetKey, value: string) {
    const current = filters[key];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ ...filters, [key]: next });
  }

  const hasAny = (Object.keys(facets) as FacetKey[]).some((k) => facets[k].length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Filters</h2>
        <Button variant="ghost" size="sm" onClick={onClear} className="h-7 px-2 text-xs">
          Clear all
        </Button>
      </div>

      {!hasAny && (
        <p className="text-xs text-muted-foreground">No filters available yet.</p>
      )}

      {(Object.keys(labels) as FacetKey[]).map((key) => {
        const options = facets[key];
        if (options.length === 0) return null;
        return (
          <div key={key} className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {labels[key]}
            </p>
            <div className="space-y-2">
              {options.map((opt) => {
                const id = `${key}-${opt}`;
                const checked = filters[key].includes(opt);
                return (
                  <div key={opt} className="flex items-center gap-2">
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={() => toggle(key, opt)}
                    />
                    <Label htmlFor={id} className="cursor-pointer text-sm font-normal">
                      {opt}
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
