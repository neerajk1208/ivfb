import { NextResponse } from "next/server";
import { ZodError, ZodIssue } from "zod";

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export function validationErrorResponse(error: ZodError) {
  const issues = error.issues as ZodIssue[];
  const messages = issues.map((e) => `${e.path.join(".")}: ${e.message}`);
  return NextResponse.json(
    { success: false, error: "Validation error", details: messages },
    { status: 400 }
  );
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { success: false, error: "Unauthorized" },
    { status: 401 }
  );
}

export function notFoundResponse(resource = "Resource") {
  return NextResponse.json(
    { success: false, error: `${resource} not found` },
    { status: 404 }
  );
}

export function serverErrorResponse(message = "Internal server error") {
  return NextResponse.json(
    { success: false, error: message },
    { status: 500 }
  );
}

export async function parseJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
