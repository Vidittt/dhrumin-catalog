from pathlib import Path
import json
import os
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types

app = FastAPI(
    title="PDF Product Processor",
    description="Extract PDF page content and embedded images, then return structured JSON for a catalog import.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
OUTPUT_DIR = Path("output")
IMAGE_OUTPUT_DIR = OUTPUT_DIR / "images"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
IMAGE_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

client = None


@app.on_event("startup")
def startup_event():
    global client
    if not GEMINI_API_KEY:
        raise RuntimeError("Please set GEMINI_API_KEY in the environment before running the server.")
    client = genai.Client(api_key=GEMINI_API_KEY)


def build_prompt() -> str:
    return """
Extract every product row from this PDF and return exactly valid JSON.
Return either a list of objects or an object with a top-level "rows" array.
Do not include any explanatory text outside the JSON.
Each row should include fields like name, brand, size, colour, category, mrp, and image_reference where available.
"""


@app.post("/process-pdf")
async def process_pdf(file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF uploads are supported.")

    pdf_bytes = await file.read()
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"),
                build_prompt(),
            ],
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Gemini request failed: {exc}")

    try:
        parsed = json.loads(response.text)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Invalid JSON from Gemini: {exc}\n{response.text}")

    if isinstance(parsed, dict) and isinstance(parsed.get("rows"), list):
        return parsed
    if isinstance(parsed, list):
        return {"rows": parsed}

    raise HTTPException(
        status_code=502,
        detail="Gemini returned invalid JSON. Expected a list or an object with a 'rows' list.",
    )
