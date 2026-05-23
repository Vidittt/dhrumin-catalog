import { supabase } from "@/integrations/supabase/client";
import type { Product } from "@/types/product";

export async function fetchProductsWithRelations(limit?: number): Promise<Product[]> {
  let query = supabase
    .from("products")
    .select(
      `*,
       vendor:vendors(id, name, contact_email),
       images:product_images(id, product_id, url, position, is_primary),
       colours:product_colours(colour)`
    )
    .order("created_at", { ascending: false });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row,
    images: (row.images ?? []).sort(
      (a: any, b: any) => Number(b.is_primary) - Number(a.is_primary) || a.position - b.position
    ),
    colours: (row.colours ?? []).map((c: any) => c.colour),
  })) as Product[];
}

export async function getOrCreateVendor(name: string, email?: string | null): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const { data: existing } = await supabase
    .from("vendors")
    .select("id")
    .eq("name", trimmed)
    .maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await supabase
    .from("vendors")
    .insert({ name: trimmed, contact_email: email?.trim() || null })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function uploadProductImage(file: File | Blob, filename?: string): Promise<string> {
  const name = filename ?? (file as File).name ?? "image.jpg";
  const ext = name.split(".").pop() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const contentType =
    (file as File).type ||
    (ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/jpeg");
  const { error } = await supabase.storage.from("product-images").upload(path, file, { contentType });
  if (error) throw error;
  return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
}
