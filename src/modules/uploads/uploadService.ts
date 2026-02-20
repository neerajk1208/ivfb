import { prisma } from "@/lib/db";
import { storage } from "./storage";
import { v4 as uuidv4 } from "uuid";

export type UploadKind = "PDF" | "IMAGE";

export interface CreateUploadInput {
  userId: string;
  cycleId?: string;
  kind: UploadKind;
  mimeType: string;
}

export async function createUploadRecord(input: CreateUploadInput) {
  const ext = getExtensionFromMimeType(input.mimeType);
  const storageKey = `${input.userId}/${uuidv4()}${ext}`;

  const upload = await prisma.upload.create({
    data: {
      userId: input.userId,
      cycleId: input.cycleId,
      kind: input.kind,
      mimeType: input.mimeType,
      storageKey,
      status: "UPLOADED",
    },
  });

  return {
    upload,
    storageKey,
  };
}

export async function saveUploadFile(
  uploadId: string,
  data: Buffer
): Promise<void> {
  const upload = await prisma.upload.findUnique({
    where: { id: uploadId },
  });

  if (!upload) {
    throw new Error("Upload not found");
  }

  await storage.save(upload.storageKey, data, upload.mimeType);
}

export async function getUploadById(uploadId: string) {
  return prisma.upload.findUnique({
    where: { id: uploadId },
  });
}

export async function updateUploadStatus(
  uploadId: string,
  status: "UPLOADED" | "PROCESSED" | "FAILED",
  extractedText?: string
) {
  return prisma.upload.update({
    where: { id: uploadId },
    data: {
      status,
      ...(extractedText !== undefined && { extractedText }),
    },
  });
}

export async function getUploadFile(storageKey: string): Promise<Buffer | null> {
  return storage.get(storageKey);
}

function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/heic": ".heic",
    "image/heif": ".heif",
  };
  return mimeToExt[mimeType] || "";
}
