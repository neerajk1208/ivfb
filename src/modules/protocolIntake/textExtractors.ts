import * as pdfParse from "pdf-parse";

export interface OCRProvider {
  extractText(imageData: Buffer, mimeType: string): Promise<string>;
}

class BasicOCRProvider implements OCRProvider {
  async extractText(imageData: Buffer, mimeType: string): Promise<string> {
    // For MVP, return a placeholder. In production, use Google Vision or Tesseract
    console.warn("OCR not configured. Using placeholder text extraction.");
    return "[Image text extraction requires OCR configuration. Please use manual intake or PDF upload.]";
  }
}

let ocrProvider: OCRProvider = new BasicOCRProvider();

export function setOCRProvider(provider: OCRProvider): void {
  ocrProvider = provider;
}

export async function extractTextFromPDF(pdfData: Buffer): Promise<string> {
  try {
    const pdf = (pdfParse as any).default || pdfParse;
    const data = await pdf(pdfData);
    return data.text.trim();
  } catch (error) {
    console.error("PDF extraction error:", error);
    throw new Error("Failed to extract text from PDF");
  }
}

export async function extractTextFromImage(
  imageData: Buffer,
  mimeType: string
): Promise<string> {
  return ocrProvider.extractText(imageData, mimeType);
}

export async function extractTextFromFile(
  fileData: Buffer,
  mimeType: string,
  kind: "PDF" | "IMAGE"
): Promise<string> {
  if (kind === "PDF" || mimeType === "application/pdf") {
    return extractTextFromPDF(fileData);
  }

  return extractTextFromImage(fileData, mimeType);
}
