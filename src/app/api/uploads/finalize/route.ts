import { NextRequest } from "next/server";
import { requireUser, getActiveCycle } from "@/lib/auth";
import { uploadFinalizeSchema } from "@/lib/validate";
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  unauthorizedResponse,
  notFoundResponse,
  serverErrorResponse,
  parseJsonBody,
} from "@/lib/http";
import {
  getUploadById,
  updateUploadStatus,
  getUploadFile,
} from "@/modules/uploads/uploadService";
import { extractTextFromFile } from "@/modules/protocolIntake/textExtractors";
import { extractProtocolFromText } from "@/modules/protocolIntake/protocolExtractor";
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

    const fileData = await getUploadFile(upload.storageKey);
    if (!fileData) {
      return errorResponse("File not found in storage");
    }

    const extractedText = await extractTextFromFile(
      fileData,
      upload.mimeType,
      upload.kind as "PDF" | "IMAGE"
    );

    await updateUploadStatus(upload.id, "PROCESSED", extractedText);

    const cycle = await getActiveCycle(user.id);
    if (!cycle) {
      return errorResponse("No active cycle found");
    }

    const extraction = await extractProtocolFromText(extractedText);

    const protocolPlan = await saveProtocolPlanDraft({
      cycleId: cycle.id,
      source: "UPLOAD",
      extraction,
      rawDocumentUrl: upload.storageKey,
    });

    return successResponse({
      protocolPlanId: protocolPlan.id,
      extraction,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    console.error("Upload finalize error:", error);
    return serverErrorResponse(
      error instanceof Error ? error.message : "Processing failed"
    );
  }
}
