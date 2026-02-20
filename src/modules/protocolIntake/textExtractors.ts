import * as pdfParse from "pdf-parse";

export async function extractTextFromPDF(pdfData: Buffer): Promise<string> {
  try {
    const pdf = (pdfParse as any).default || pdfParse;
    const data = await pdf(pdfData);
    const text = data.text.trim();
    if (!text || text.length < 20) {
      throw new Error("PDF appears to be empty or contains no readable text");
    }
    return text;
  } catch (error) {
    console.error("PDF extraction error:", error);
    throw new Error("Failed to extract text from PDF. The file may be image-based or corrupted.");
  }
}

export function imageToBase64(imageData: Buffer, mimeType: string): string {
  const base64 = imageData.toString("base64");
  return `data:${mimeType};base64,${base64}`;
}

export async function extractTextFromFile(
  fileData: Buffer,
  mimeType: string,
  kind: "PDF" | "IMAGE"
): Promise<{ type: "text"; content: string } | { type: "image"; base64: string }> {
  if (kind === "PDF" || mimeType === "application/pdf") {
    const text = await extractTextFromPDF(fileData);
    return { type: "text", content: text };
  }

  // For images, return base64 to send directly to OpenAI Vision
  const base64 = imageToBase64(fileData, mimeType);
  return { type: "image", base64 };
}
