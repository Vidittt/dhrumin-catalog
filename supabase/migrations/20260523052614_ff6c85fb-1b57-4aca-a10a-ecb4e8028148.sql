
-- Enum for stock status
DO $$ BEGIN
  CREATE TYPE public.stock_status AS ENUM ('in_stock', 'out_of_stock', 'preorder');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Vendors table
CREATE TABLE public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  contact_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view vendors" ON public.vendors FOR SELECT USING (true);
CREATE POLICY "Anyone can insert vendors" ON public.vendors FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update vendors" ON public.vendors FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete vendors" ON public.vendors FOR DELETE USING (true);

-- Extend products
ALTER TABLE public.products
  ADD COLUMN product_id TEXT UNIQUE,
  ADD COLUMN display_name TEXT,
  ADD COLUMN product_name TEXT,
  ADD COLUMN vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  ADD COLUMN price_per_unit NUMERIC(10,2),
  ADD COLUMN gst_rate NUMERIC(5,2),
  ADD COLUMN packaging TEXT,
  ADD COLUMN stock_status public.stock_status NOT NULL DEFAULT 'in_stock',
  ADD COLUMN video_url TEXT,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill display_name from name
UPDATE public.products SET display_name = name WHERE display_name IS NULL;
ALTER TABLE public.products ALTER COLUMN display_name SET NOT NULL;

-- product_images
CREATE TABLE public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_images_product ON public.product_images(product_id, position);
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view product_images" ON public.product_images FOR SELECT USING (true);
CREATE POLICY "Anyone can insert product_images" ON public.product_images FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update product_images" ON public.product_images FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete product_images" ON public.product_images FOR DELETE USING (true);

-- product_colours
CREATE TABLE public.product_colours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  colour TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, colour)
);
CREATE INDEX idx_product_colours_colour ON public.product_colours(colour);
ALTER TABLE public.product_colours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view product_colours" ON public.product_colours FOR SELECT USING (true);
CREATE POLICY "Anyone can insert product_colours" ON public.product_colours FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update product_colours" ON public.product_colours FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete product_colours" ON public.product_colours FOR DELETE USING (true);

-- Backfill images from products.image_url
INSERT INTO public.product_images (product_id, url, position, is_primary)
SELECT id, image_url, 0, true FROM public.products WHERE image_url IS NOT NULL AND image_url <> '';

-- Backfill colours from products.colour
INSERT INTO public.product_colours (product_id, colour)
SELECT id, colour FROM public.products WHERE colour IS NOT NULL AND colour <> ''
ON CONFLICT DO NOTHING;

-- Drop old columns
ALTER TABLE public.products
  DROP COLUMN image_url,
  DROP COLUMN colour,
  DROP COLUMN capacity;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_products_vendor ON public.products(vendor_id);
CREATE INDEX idx_products_category ON public.products(category);
CREATE INDEX idx_products_subcategory ON public.products(subcategory);
CREATE INDEX idx_products_stock_status ON public.products(stock_status);
