ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS original_price numeric,
  ADD COLUMN IF NOT EXISTS discounted_price numeric,
  ADD COLUMN IF NOT EXISTS material text,
  ADD COLUMN IF NOT EXISTS dimensions text;

CREATE POLICY "Anyone can update products"
ON public.products
FOR UPDATE
USING (true)
WITH CHECK (true);