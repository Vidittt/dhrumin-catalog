import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Product } from "@/types/product";
import { ImageOff } from "lucide-react";

function formatPrice(value: number) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function ProductCard({ product }: { product: Product }) {
  const hasDiscount =
    product.discounted_price != null &&
    product.original_price != null &&
    product.discounted_price < product.original_price;
  const primaryPrice = product.discounted_price ?? product.original_price;

  const specs: { label: string; value: string }[] = [
    product.size ? { label: "Size", value: product.size } : null,
    product.colour ? { label: "Colour", value: product.colour } : null,
    product.material ? { label: "Material", value: product.material } : null,
    product.dimensions ? { label: "Dimensions", value: product.dimensions } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card
          role="button"
          tabIndex={0}
          className="cursor-pointer overflow-hidden transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
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
      </DialogTrigger>

      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <div className="grid gap-0 md:grid-cols-2 max-h-[85vh] overflow-y-auto">
          <div className="relative aspect-square w-full bg-muted">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <ImageOff className="h-12 w-12" />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 p-6">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="text-xl leading-tight">{product.name}</DialogTitle>
              {product.brand && (
                <p className="text-sm text-muted-foreground">{product.brand}</p>
              )}
            </DialogHeader>

            {primaryPrice != null && (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-foreground">
                  ₹{formatPrice(primaryPrice)}
                </span>
                {hasDiscount && (
                  <span className="text-sm text-muted-foreground line-through">
                    ₹{formatPrice(product.original_price!)}
                  </span>
                )}
              </div>
            )}

            {(product.category || product.subcategory) && (
              <div className="flex flex-wrap gap-1.5">
                {product.category && (
                  <Badge variant="secondary">{product.category}</Badge>
                )}
                {product.subcategory && (
                  <Badge variant="secondary">{product.subcategory}</Badge>
                )}
              </div>
            )}

            {specs.length > 0 && (
              <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 border-t pt-4 text-sm">
                {specs.map((spec) => (
                  <div key={spec.label} className="contents">
                    <dt className="text-muted-foreground">{spec.label}</dt>
                    <dd className="text-foreground">{spec.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            <p className="mt-auto pt-4 text-xs text-muted-foreground">
              Added on {formatDate(product.created_at)}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
