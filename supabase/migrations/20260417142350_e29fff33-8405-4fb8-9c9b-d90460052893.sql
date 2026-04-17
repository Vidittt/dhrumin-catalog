
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT,
  brand TEXT,
  size TEXT,
  capacity TEXT,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view products"
  ON public.products FOR SELECT USING (true);

CREATE POLICY "Anyone can insert products"
  ON public.products FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can delete products"
  ON public.products FOR DELETE USING (true);

CREATE INDEX idx_products_created_at ON public.products(created_at DESC);

INSERT INTO storage.buckets (id, name, public)
  VALUES ('product-images', 'product-images', true);

CREATE POLICY "Public read product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

CREATE POLICY "Anyone can upload product images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-images');
