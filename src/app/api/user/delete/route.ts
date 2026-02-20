import { requireUser } from "@/lib/auth";
import {
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from "@/lib/http";
import { deleteUser } from "@/modules/user/userService";

export async function DELETE() {
  try {
    const user = await requireUser();

    await deleteUser(user.id);

    return successResponse({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorizedResponse();
    }
    console.error("User delete error:", error);
    return serverErrorResponse();
  }
}
