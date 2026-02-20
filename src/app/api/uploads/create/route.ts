import { NextRequest } from "next/server";
import { requireUser, getActiveCycle } from "@/lib/auth";
import { uploadCreateSchema } from "@/lib/validate";
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  unauthorizedResponse,
  serverErrorResponse,
  parseJsonBody,
} from "@/lib/http";
import { createUploadRecord } from "@/modules/uploads/uploadService";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    const body = await parseJsonBody(request);
    if (!body) {
      return errorResponse("Invalid JSON body");
    }

    const parsed = uploadCreateSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const cycle = await getActiveCycle(user.id);
    const cycleId = parsed.data.cycleId || cycle?.id;

    const result = await createUploadRecord({
      userId: user.id,
      cycleId: cycleId || undefined,
      kind: parsed.data.kind,
      mimeType: parsed.data.mimeType,
    });

    return successResponse({
      uploadId: result.upload.id,
      storageKey: result.storageKey,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    console.error("Upload create error:", error);
    return serverErrorResponse();
  }
}
