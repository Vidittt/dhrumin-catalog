from pathlib import Path
import json
import os
import fitz
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


def make_image_mime_type(ext: str) -> str:
    normalized = ext.lower()
    if normalized == "jpg":
        normalized = "jpeg"
    return f"image/{normalized}"


def build_prompt() -> str:
    return """
Analyze this page and extract each product row as a clean JSON array.
If one of the isolated images belongs to a product row, use the corresponding IMAGE_REFERENCE_X string to link it.
Return exactly valid JSON in this shape:
[
  {
    "name": "String",
    "brand": "String",
    "size": "String",
    "colour": "String",
    "category": "String",
    "mrp": "String",
    "image_reference": "IMAGE_REFERENCE_0"
  }
]

If a field is not present, return an empty string or null for that field.
If there are no isolated images on the page, omit the "image_reference" field or set it to null.
"""


@app.post("/process-pdf")
async def process_pdf(file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF uploads are supported.")

    pdf_bytes = await file.read()
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to open PDF: {exc}")

    all_rows = []

    for page_num in range(len(doc)):
        page = doc[page_num]
        image_list = page.get_images(full=True)
        inline_images_payload = []
        saved_image_filenames = []

        for img_idx, img in enumerate(image_list):
            xref = img[0]
            base_image = doc.extract_image(xref)
            image_bytes = base_image["image"]
            image_ext = base_image["ext"].lower()
            image_filename = f"page_{page_num}_img_{img_idx}.{image_ext}"
            image_path = IMAGE_OUTPUT_DIR / image_filename
            with open(image_path, "wb") as image_file:
                image_file.write(image_bytes)

            saved_image_filenames.append(str(image_path.as_posix()))
            inline_images_payload.append(
                types.Part.from_bytes(
                    data=image_bytes,
                    mime_type=make_image_mime_type(image_ext),
                )
            )

        page_pix = page.get_pixmap()
        page_bytes = page_pix.tobytes("png")

        contents = [
            types.Part.from_bytes(data=page_bytes, mime_type="image/png"),
            "Here is the rendered PDF page for context.",
        ]

        for idx, img_part in enumerate(inline_images_payload):
            contents.append(f"\n--- This is IMAGE_REFERENCE_{idx} ---")
            contents.append(img_part)

        contents.append(build_prompt())

        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=contents,
                config=types.GenerateContentConfig(response_mime_type="application/json"),
            )
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Gemini request failed: {exc}")

        try:
            page_rows = json.loads(response.text)
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Invalid JSON from Gemini: {exc}\n{response.text}")

        if not isinstance(page_rows, list):
            raise HTTPException(status_code=502, detail="Gemini returned a non-array JSON response.")

        for row in page_rows:
            ref_str = row.get("image_reference") if isinstance(row, dict) else None
            if isinstance(ref_str, str) and "IMAGE_REFERENCE_" in ref_str:
                try:
                    image_index = int(ref_str.split("_")[-1])
                    row["actual_image_path"] = saved_image_filenames[image_index]
                except (ValueError, IndexError):
                    row["actual_image_path"] = None
            else:
                row["actual_image_path"] = None
            row["page_number"] = page_num

        all_rows.extend(page_rows)

    return {"rows": all_rows}
