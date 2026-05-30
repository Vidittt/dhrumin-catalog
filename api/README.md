# PDF Processor Backend

This backend accepts a PDF upload, extracts embedded images with PyMuPDF, sends the page + images to Gemini for structured JSON extraction, and returns parsed rows with real image file paths.

## Setup

1. Create a Python environment:

   python -m venv .venv
   .\.venv\Scripts\activate

2. Install dependencies:

   python -m pip install -r requirements.txt

3. Set your Gemini key:

   set GEMINI_API_KEY=your_key_here

4. Run the app:

   uvicorn main:app --reload --port 8000

## Endpoint

POST `/process-pdf`
- body: `multipart/form-data` with field `file` containing the PDF
- returns: `{ "rows": [ ... ] }`

Extracted images are written to `server/output/images/`.
