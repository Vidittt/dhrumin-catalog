export type Product = {
  id: string;
  name: string;
  image_url: string | null;
  brand: string | null;
  size: string | null;
  colour: string | null;
  category: string | null;
  subcategory: string | null;
  material: string | null;
  dimensions: string | null;
  original_price: number | null;
  discounted_price: number | null;
  created_at: string;
};
