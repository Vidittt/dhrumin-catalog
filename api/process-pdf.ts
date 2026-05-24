import { IncomingForm } from "formidable";
import fs from "fs";
import type { IncomingMessage, ServerResponse } from "http";
import pdfjsLib from "pdfjs-dist/legacy/build/pdf.js";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-1.5-mini";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function parseForm(req: IncomingMessage): Promise<{ file: { filepath: string; originalFilename?: string | null } }> {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm();
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      const file = Array.isArray(files.file) ? files.file[0] : files.file;
      if (!file || typeof file === "string") {
        return reject(new Error("Missing file upload"));
      }
      resolve({ file });
    });
  });
}

async function extractPdfText(pdfBytes: Uint8Array) {
  const doc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item: any) => item.str).join(" ");
    pages.push(`PAGE ${pageNumber}:\n${text}`);
  }
  return pages;
}

async function callGemini(prompt: string) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required for the PDF processor.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta2/models/${encodeURIComponent(
    GEMINI_MODEL,
  )}:generate?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: {
        text: prompt,
      },
      temperature: 0,
      maxOutputTokens: 1500,
    }),
  });

  const data: any = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.error || "Gemini request failed");
  }

  const candidate = data?.candidates?.[0] || data?.output?.[0];
  const text =
    candidate?.content ||
    candidate?.output?.[0]?.content ||
    candidate?.message?.content?.[0]?.text ||
    candidate?.message?.content ||
    "";

  if (!text) {
    throw new Error("Empty response from Gemini");
  }

  return text;
}

function buildPrompt(pageTexts: string[]) {
  return `Extract all products from the PDF document into a JSON array. Return only valid JSON with no additional text. Use the exact property names shown below. If a field is not present, use null or an empty string. Do not invent fields.

Schema:
[
  {
    "display_name": "String",
    "product_name": "String",
    "product_id": "String",
    "brand": "String",
    "vendor": "String",
    "size": "String",
    "category": "String",
    "subcategory": "String",
    "material": "String",
    "dimensions": "String",
    "packaging": "String",
    "original_price": "String",
    "discounted_price": "String",
    "price_per_unit": "String",
    "gst_rate": "String",
    "stock_status": "in_stock|out_of_stock|preorder",
    "video_url": "String"
  }
]

Document text:
${pageTexts.join("\n\n")}`;
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const { file } = await parseForm(req);
    const fileBuffer = await fs.promises.readFile(file.filepath);
    const pageTexts = await extractPdfText(new Uint8Array(fileBuffer));
    const prompt = buildPrompt(pageTexts);
    const llmResponse = await callGemini(prompt);
    const rows = JSON.parse(llmResponse);
    if (!Array.isArray(rows)) {
      throw new Error("LLM response did not produce a JSON array");
    }
    sendJson(res, 200, { rows });
  } catch (err: any) {
    sendJson(res, 500, { error: err.message ?? "PDF processing failed" });
  }
}
