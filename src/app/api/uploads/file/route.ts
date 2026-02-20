import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  notFoundResponse,
  serverErrorResponse,
} from "@/lib/http";
import { getUploadById, saveUploadFile } from "@/modules/uploads/uploadService";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const uploadId = formData.get("uploadId") as string | null;

    if (!file || !uploadId) {
      return errorResponse("Missing file or uploadId");
    }

    const upload = await getUploadById(uploadId);
    if (!upload || upload.userId !== user.id) {
      return notFoundResponse("Upload");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    await saveUploadFile(uploadId, buffer);

    return successResponse({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    console.error("File upload error:", error);
    return serverErrorResponse();
  }
}
