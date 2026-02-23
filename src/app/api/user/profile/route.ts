import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { profileUpdateSchema } from "@/lib/validate";
import { 
  successResponse, 
  errorResponse, 
  validationErrorResponse, 
  unauthorizedResponse,
  serverErrorResponse,
  parseJsonBody 
} from "@/lib/http";
import { updateUserProfile } from "@/modules/user/userService";

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser();
    
    const body = await parseJsonBody(request);
    if (!body) {
      return errorResponse("Invalid JSON body");
    }

    const parsed = profileUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const updatedUser = await updateUserProfile(user.id, parsed.data);

    return successResponse({
      id: updatedUser.id,
      timezone: updatedUser.timezone,
      phoneE164: updatedUser.phoneE164,
      smsConsent: updatedUser.smsConsent,
      quietHours: updatedUser.quietHours,
    });
  } catch (error: any) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    if (error?.code === "P2002" && error?.meta?.target?.includes("phoneE164")) {
      return errorResponse("This phone number is already registered to another account");
    }
    console.error("Profile update error:", error);
    return serverErrorResponse();
  }
}
