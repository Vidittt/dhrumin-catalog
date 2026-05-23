import { IncomingForm } from "formidable";
import fs from "fs";
import type { IncomingMessage, ServerResponse } from "http";
import pdfjsLib from "pdfjs-dist/legacy/build/pdf.js";

const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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

async function callOpenAi(prompt: string) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for the PDF processor.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a PDF extraction assistant. Extract structured product catalog data from the supplied document text and return valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0,
      max_tokens: 1500,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "OpenAI request failed");
  }

  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("Empty response from OpenAI");
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
    const llmResponse = await callOpenAi(prompt);
    const rows = JSON.parse(llmResponse);
    if (!Array.isArray(rows)) {
      throw new Error("LLM response did not produce a JSON array");
    }
    sendJson(res, 200, { rows });
  } catch (err: any) {
    sendJson(res, 500, { error: err.message ?? "PDF processing failed" });
  }
}
