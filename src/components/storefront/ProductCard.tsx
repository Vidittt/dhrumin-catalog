import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Product, StockStatus } from "@/types/product";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";

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

const STOCK_LABEL: Record<StockStatus, string> = {
  in_stock: "In stock",
  out_of_stock: "Out of stock",
  preorder: "Pre-order",
};

const STOCK_VARIANT: Record<StockStatus, "default" | "secondary" | "destructive" | "outline"> = {
  in_stock: "default",
  out_of_stock: "destructive",
  preorder: "secondary",
};

function getYouTubeEmbed(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

export function ProductCard({ product }: { product: Product }) {
  const [imgIdx, setImgIdx] = useState(0);
  const hasDiscount =
    product.discounted_price != null &&
    product.original_price != null &&
    product.discounted_price < product.original_price;
  const primaryPrice = product.discounted_price ?? product.original_price;
  const images = product.images ?? [];
  const cardImage = images[0]?.url ?? null;
  const dialogImage = images[imgIdx]?.url ?? null;
  const title = product.display_name || product.name;
  const ytEmbed = product.video_url ? getYouTubeEmbed(product.video_url) : null;

  const specs: { label: string; value: string }[] = [
    product.size ? { label: "Size", value: product.size } : null,
    product.colours.length ? { label: "Colours", value: product.colours.join(", ") } : null,
    product.material ? { label: "Material", value: product.material } : null,
    product.dimensions ? { label: "Dimensions", value: product.dimensions } : null,
    product.packaging ? { label: "Packaging", value: product.packaging } : null,
    product.price_per_unit != null
      ? { label: "Price / unit", value: `₹${formatPrice(product.price_per_unit)}` }
      : null,
    product.gst_rate != null ? { label: "GST", value: `${product.gst_rate}%` } : null,
    product.product_id ? { label: "Product ID", value: product.product_id } : null,
    product.product_name ? { label: "Product name", value: product.product_name } : null,
    product.vendor?.name ? { label: "Vendor", value: product.vendor.name } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <Dialog onOpenChange={(o) => o && setImgIdx(0)}>
      <DialogTrigger asChild>
        <Card
          role="button"
          tabIndex={0}
          className="cursor-pointer overflow-hidden transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <div className="relative aspect-square w-full bg-muted">
            {cardImage ? (
              <img src={cardImage} alt={title} loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <ImageOff className="h-8 w-8" />
              </div>
            )}
            {images.length > 1 && (
              <span className="absolute bottom-2 right-2 rounded-full bg-background/80 px-2 py-0.5 text-[10px] text-foreground backdrop-blur">
                +{images.length - 1}
              </span>
            )}
          </div>
          <CardContent className="space-y-2 p-4">
            <div>
              <h3 className="line-clamp-2 text-sm font-medium leading-tight">{title}</h3>
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
              <Badge variant={STOCK_VARIANT[product.stock_status]} className="text-[10px]">
                {STOCK_LABEL[product.stock_status]}
              </Badge>
              {product.category && <Badge variant="secondary" className="text-[10px]">{product.category}</Badge>}
              {product.subcategory && <Badge variant="secondary" className="text-[10px]">{product.subcategory}</Badge>}
              {product.size && <Badge variant="outline" className="text-[10px]">Size: {product.size}</Badge>}
              {product.colours.slice(0, 3).map((c) => (
                <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>

      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <div className="grid gap-0 md:grid-cols-2 max-h-[85vh] overflow-y-auto">
          <div className="relative aspect-square w-full bg-muted">
            {dialogImage ? (
              <img src={dialogImage} alt={title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <ImageOff className="h-12 w-12" />
              </div>
            )}
            {images.length > 1 && (
              <>
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full opacity-90"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImgIdx((i) => (i - 1 + images.length) % images.length);
                  }}
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full opacity-90"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImgIdx((i) => (i + 1) % images.length);
                  }}
                  aria-label="Next image"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-background/80 px-2 py-0.5 text-[10px] backdrop-blur">
                  {imgIdx + 1} / {images.length}
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col gap-4 p-6">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="text-xl leading-tight">{title}</DialogTitle>
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

            <div className="flex flex-wrap gap-1.5">
              <Badge variant={STOCK_VARIANT[product.stock_status]}>
                {STOCK_LABEL[product.stock_status]}
              </Badge>
              {product.category && <Badge variant="secondary">{product.category}</Badge>}
              {product.subcategory && <Badge variant="secondary">{product.subcategory}</Badge>}
            </div>

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

            {product.video_url && (
              <div className="border-t pt-4">
                <p className="mb-2 text-sm font-medium">Video</p>
                {ytEmbed ? (
                  <div className="aspect-video w-full overflow-hidden rounded-md">
                    <iframe
                      src={ytEmbed}
                      title="Product video"
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <a
                    href={product.video_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary underline"
                  >
                    {product.video_url}
                  </a>
                )}
              </div>
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
