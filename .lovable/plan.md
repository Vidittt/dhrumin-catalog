
## Bulk import — button + modal

Replace the planned 3-column layout with a single "Bulk import" button in the admin header. Clicking it opens a modal that contains the entire bulk import flow.

### UI placement

Admin page layout stays as today (2-column: New product + Recent products). Add a button to the header next to "View storefront":

```text
Header: [Admin · Add product]      [Bulk import] [View storefront]
Body:   [New product]   [Recent products]
```

### Modal contents

Built with the existing `Dialog` component (`src/components/ui/dialog.tsx`). Wide modal (`max-w-3xl`), scrollable body. Inside:

1. **Intro + template** — one-line explainer + "Download CSV template" button.
2. **File inputs** — CSV (required) and ZIP of images (optional).
3. **Preview table** — appears after files are picked. Shows parsed rows, validation status per row, and image-match status (✓ found / ✗ missing / — none). Invalid rows highlighted.
4. **Footer** — row counts ("47 valid · 3 invalid · 12 images matched"), `Cancel` button, and `Import N products` button. Button shows progress (`Importing 12 / 47…`) during run.
5. **Result summary** — after import completes, swap the table for a summary (success/failure counts + any per-row errors), with a `Close` button. Closing refreshes the recent products list.

Modal can't be dismissed (overlay click / esc disabled) while an import is in progress, to avoid orphaned uploads.

### CSV format & matching (unchanged from prior plan)

Columns: `name, brand, size, colour, category, subcategory, material, dimensions, original_price, discounted_price, image_filename`.
`image_filename` matched case-insensitively against ZIP entries (folder paths ignored).

### Validation (unchanged)
- `name` required
- prices must be valid non-negative numbers if present
- `discounted_price ≤ original_price` when both set
- Invalid rows skipped on import (user sees them flagged in preview).

### Libraries
- `papaparse` — CSV parsing
- `jszip` — read ZIP entries in the browser

### Files to add / change
- **New**: `src/components/admin/BulkImportDialog.tsx` — button trigger + dialog + full flow (template download, file inputs, preview, import, summary).
- **Edit**: `src/pages/Admin.tsx` — render `<BulkImportDialog onImported={fetchProducts} />` in the header. No layout change to the body.
- **Edit**: `package.json` — add `papaparse`, `jszip`, `@types/papaparse`.

### Out of scope
- Server-side bulk endpoint
- Editing existing products via CSV (insert-only)
- Excel (.xlsx) input — CSV only
