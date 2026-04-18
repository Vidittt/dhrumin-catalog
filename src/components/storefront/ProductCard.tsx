import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Product } from "@/types/product";
import { ImageOff } from "lucide-react";

function formatPrice(value: number) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function ProductCard({ product }: { product: Product }) {
  const hasDiscount =
    product.discounted_price != null &&
    product.original_price != null &&
    product.discounted_price < product.original_price;
  const primaryPrice = product.discounted_price ?? product.original_price;

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <div className="relative aspect-square w-full bg-muted">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageOff className="h-8 w-8" />
          </div>
        )}
      </div>
      <CardContent className="space-y-2 p-4">
        <div>
          <h3 className="line-clamp-2 text-sm font-medium leading-tight">{product.name}</h3>
          {product.brand && (
            <p className="mt-0.5 text-xs text-muted-foreground">{product.brand}</p>
          )}
        </div>

        {primaryPrice != null && (
          <div className="flex items-baseline gap-2">
            <span className="text-base font-semibold text-foreground">
              ₹{formatPrice(primaryPrice)}
            </span>
            {hasDiscount && (
              <span className="text-xs text-muted-foreground line-through">
                ₹{formatPrice(product.original_price!)}
              </span>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-1">
          {product.category && <Badge variant="secondary" className="text-[10px]">{product.category}</Badge>}
          {product.subcategory && <Badge variant="secondary" className="text-[10px]">{product.subcategory}</Badge>}
          {product.size && <Badge variant="outline" className="text-[10px]">Size: {product.size}</Badge>}
          {product.colour && <Badge variant="outline" className="text-[10px]">{product.colour}</Badge>}
        </div>

        {(product.material || product.dimensions) && (
          <div className="space-y-0.5 pt-1 text-xs text-muted-foreground">
            {product.material && <p>Material: {product.material}</p>}
            {product.dimensions && <p>Dimensions: {product.dimensions}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
