import { NextRequest, NextResponse } from "next/server";
import { requireUser, getActiveCycle } from "@/lib/auth";
import { uploadFinalizeSchema } from "@/lib/validate";
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  unauthorizedResponse,
  notFoundResponse,
  parseJsonBody,
} from "@/lib/http";
import {
  getUploadById,
  updateUploadStatus,
  getUploadFile,
} from "@/modules/uploads/uploadService";
import { extractTextFromFile } from "@/modules/protocolIntake/textExtractors";
import { extractProtocolFromText, extractProtocolFromImage } from "@/modules/protocolIntake/protocolExtractor";
import { saveProtocolPlanDraft } from "@/modules/protocolIntake/protocolNormalizer";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    const body = await parseJsonBody(request);
    if (!body) {
      return errorResponse("Invalid JSON body");
    }

    const parsed = uploadFinalizeSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const upload = await getUploadById(parsed.data.uploadId);
    if (!upload || upload.userId !== user.id) {
      return notFoundResponse("Upload");
    }

    console.log(`Processing upload: ${upload.id}, kind: ${upload.kind}, mime: ${upload.mimeType}`);

    const fileData = await getUploadFile(upload.storageKey, upload.id);
    if (!fileData) {
      return errorResponse("File not found in storage. Please try uploading again.");
    }

    console.log(`File loaded: ${fileData.length} bytes`);

    // Extract text or get image base64
    let fileResult;
    try {
      fileResult = await extractTextFromFile(
        fileData,
        upload.mimeType,
        upload.kind as "PDF" | "IMAGE"
      );
      console.log(`Extraction type: ${fileResult.type}`);
    } catch (extractError) {
      console.error("File extraction error:", extractError);
      return errorResponse("Could not read the file. Please try a different file or enter manually.");
    }

    // Update upload with extracted text or note about image
    const textForStorage = fileResult.type === "text" 
      ? fileResult.content 
      : "[Image - sent to vision model]";
    await updateUploadStatus(upload.id, "PROCESSED", textForStorage);

    const cycle = await getActiveCycle(user.id);
    if (!cycle) {
      return errorResponse("No active cycle found");
    }

    // Use appropriate extraction method based on file type
    console.log(`Calling OpenAI for ${fileResult.type} extraction...`);
    const extraction = fileResult.type === "text"
      ? await extractProtocolFromText(fileResult.content)
      : await extractProtocolFromImage(fileResult.base64);
    console.log(`Extraction complete. Medications found: ${extraction.medications.length}`);

    // Check if extraction failed completely
    const extractionFailed = extraction.missingFields?.includes("extraction_failed");
    const noMedications = extraction.medications.length === 0;

    const protocolPlan = await saveProtocolPlanDraft({
      cycleId: cycle.id,
      source: "UPLOAD",
      extraction,
      rawDocumentUrl: upload.storageKey,
    });

    return successResponse({
      protocolPlanId: protocolPlan.id,
      extraction,
      warning: extractionFailed 
        ? "Could not extract protocol from this file. Please add medications manually."
        : noMedications 
          ? "No medications found. Please add them manually on the review page."
          : null,
    });
  } catch (error: any) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    console.error("Upload finalize error:", error?.message || error);
    
    // Always return JSON
    return NextResponse.json(
      { 
        success: false, 
        error: error?.message || "Processing failed. Please try again or enter your protocol manually." 
      },
      { status: 500 }
    );
  }
}
