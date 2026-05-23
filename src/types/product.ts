export type StockStatus = "in_stock" | "out_of_stock" | "preorder";

export type ProductImage = {
  id: string;
  product_id: string;
  url: string;
  position: number;
  is_primary: boolean;
};

export type Vendor = {
  id: string;
  name: string;
  contact_email: string | null;
};

export type Product = {
  id: string;
  name: string;
  display_name: string;
  product_name: string | null;
  product_id: string | null;
  brand: string | null;
  size: string | null;
  category: string | null;
  subcategory: string | null;
  material: string | null;
  dimensions: string | null;
  original_price: number | null;
  discounted_price: number | null;
  price_per_unit: number | null;
  gst_rate: number | null;
  packaging: string | null;
  stock_status: StockStatus;
  video_url: string | null;
  vendor_id: string | null;
  vendor?: Vendor | null;
  images: ProductImage[];
  colours: string[];
  created_at: string;
  updated_at: string;
};
