# Welcome to your Lovable project

This project is a Vite + React admin/catalog frontend using Supabase.

## PDF import backend

A new Python backend has been added under `server/` to process PDF uploads with PyMuPDF and Gemini.

- `server/requirements.txt` contains Python dependencies.
- `server/main.py` exposes `/process-pdf`.
- `server/README.md` has setup and run instructions.

The frontend admin page now includes a PDF import flow that can post to `VITE_PDF_PROCESSOR_URL` or `http://localhost:8000` by default.

For local development, add this to your `.env`:

```env
VITE_PDF_PROCESSOR_URL=http://localhost:8000
```

For Vercel deployment, use the internal API route instead:

```env
VITE_PDF_PROCESSOR_URL=/api
```
