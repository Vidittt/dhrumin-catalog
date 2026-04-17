import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Product } from "@/types/product";
import { ImageOff } from "lucide-react";

export function ProductCard({ product }: { product: Product }) {
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
        <div className="flex flex-wrap gap-1">
          {product.category && <Badge variant="secondary" className="text-[10px]">{product.category}</Badge>}
          {product.size && <Badge variant="outline" className="text-[10px]">Size: {product.size}</Badge>}
          {product.capacity && <Badge variant="outline" className="text-[10px]">{product.capacity}</Badge>}
        </div>
      </CardContent>
    </Card>
  );
}
