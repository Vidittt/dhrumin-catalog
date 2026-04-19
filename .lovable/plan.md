
## Expand product card to view full details

Make any product card on the storefront clickable. Clicking opens a modal showing the full product details (large image + every field).

### Interaction
- The whole card becomes a button (cursor-pointer, keyboard-accessible).
- Click / Enter / Space → opens a centered Dialog modal.
- Close via overlay click, ESC, or the built-in close button.

### Modal contents
Wide modal (`max-w-3xl`), 2-column layout on desktop, stacked on mobile:
- **Left**: large product image (square, full width of column). Falls back to placeholder icon if no image.
- **Right**:
  - Product name (large heading)
  - Brand (muted)
  - Price block: discounted price prominent; original price struck-through next to it when both set
  - Category / Subcategory chips
  - A clean "spec list" showing every populated field as label/value rows:
    - Size, Colour, Material, Dimensions
  - "Added on" date (from `created_at`), small + muted at the bottom

Empty fields are simply omitted (no "N/A" rows).

### Files touched
- **Edit**: `src/components/storefront/ProductCard.tsx` — wrap card in a Dialog trigger; add `<ProductDetailDialog>` inline (or as a small sibling component in the same file to keep things tidy).

No other files need to change — `Index.tsx`, filters, and types stay as-is.

### Out of scope
- Dedicated `/product/:id` route (modal is enough for now; can add later for shareable links)
- Image gallery / multiple images (schema has one `image_url`)
- Add-to-cart / purchase actions
