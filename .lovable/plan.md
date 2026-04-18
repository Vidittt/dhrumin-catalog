
## Add 6 new product attributes

### 1. Database migration
Add 5 new columns to `products` (colour already exists):
- `subcategory` (text, nullable)
- `original_price` (numeric, nullable)
- `discounted_price` (numeric, nullable)
- `material` (text, nullable)
- `dimensions` (text, nullable) — free-form e.g. "30 × 20 × 10 cm"

Also add an `UPDATE` RLS policy (public) so future edits work — currently missing.

### 2. Type update
Extend `src/types/product.ts` with the 5 new fields.

### 3. Admin form (`src/pages/Admin.tsx`)
Add inputs for: Subcategory, Original price, Discounted price, Material, Dimensions.
- Prices use `type="number"` with step `0.01`, stored as numeric (or null if blank)
- Subcategory and Material get datalist suggestions (like brand/category)
- Dimensions is a plain text input with placeholder e.g. "30 × 20 × 10 cm"
- Validation: if both prices set, `discounted_price ≤ original_price` (toast error otherwise)

### 4. Storefront filters (`FilterPanel` + `Index.tsx`)
Add **Subcategory** and **Material** as new checkbox facets in the sidebar.
- Prices and dimensions are NOT filters (free-form/continuous values) — they only display on cards.
- `Filters` type and `emptyFilters` extended accordingly.

### 5. Product card (`ProductCard.tsx`)
Display:
- Price block: discounted price prominent, original price struck-through next to it (when both present); single price if only one set.
- Subcategory chip (alongside category)
- Material and Dimensions shown as small text lines below chips

### Out of scope
- Editing existing products (UPDATE policy added but no edit UI yet)
- Currency selector (assume single implicit currency)
- Price range slider filter

### Files touched
- New SQL migration
- `src/types/product.ts`
- `src/pages/Admin.tsx`
- `src/pages/Index.tsx`
- `src/components/storefront/FilterPanel.tsx`
- `src/components/storefront/ProductCard.tsx`
