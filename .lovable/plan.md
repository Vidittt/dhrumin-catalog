
## Mini Storefront with Admin Catalog

A simple two-surface app: a public storefront with search + filters, and a hidden `/admin` route to add products. Backed by Lovable Cloud (database + storage), no auth gate.

### 1. Backend (Lovable Cloud)

**`products` table**
- `id` (uuid), `created_at`
- `name` (text)
- `image_url` (text)
- `brand` (text)
- `size` (text)
- `capacity` (text)
- `category` (text)

**RLS policies**
- Public `SELECT` for everyone
- Public `INSERT` for everyone (since admin route is unprotected by design — noted as a tradeoff)

**Storage**
- Public bucket `product-images` for uploaded product photos
- Public read; public insert policy

### 2. Storefront — `/`

Layout: filter sidebar on the left, product grid on the right. Collapses to a top filter sheet on mobile.

- **Top bar**: app title + search input (filters as you type)
- **Sidebar filters** (checkbox groups, multi-select):
  - Brand, Size, Capacity, Category
  - Each facet's options derived dynamically from the current product set
  - "Clear all" button
- **Product grid**: image, name, brand, category, size/capacity chips
- **Empty state** when nothing matches
- Filtering logic: search string (name/brand contains) AND for each facet, product matches if its value is in the selected set (or set is empty)

### 3. Admin — `/admin`

Hidden route (not linked from storefront — accessed by typing the URL).

- "Add Product" form with controlled inputs:
  - Name (required)
  - Image upload (file picker → uploads to storage → stores public URL)
  - Brand, Size, Capacity, Category (text inputs with suggestions from existing values)
- Submit → inserts into `products`, shows toast, clears form
- Below the form: simple list of recently added products with thumbnail + delete button

After insert, storefront query refetches so new product is immediately searchable.

### 4. Design

Clean, functional, light theme. Neutral palette with one accent color for primary actions. Card-based product tiles, generous whitespace, rounded corners. Mobile-first responsive grid (1 col → 2 → 3 → 4).

### 5. Out of scope (can add later)
- Auth-protected admin
- Edit product
- Price, stock, product detail page
- Pagination (will load all products initially)
