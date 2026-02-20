import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/db";

export interface StorageProvider {
  save(key: string, data: Buffer, mimeType: string, uploadId?: string): Promise<string>;
  get(key: string, uploadId?: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  getUrl(key: string): Promise<string>;
}

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
}

export class LocalStorageProvider implements StorageProvider {
  async save(key: string, data: Buffer, mimeType: string): Promise<string> {
    await ensureUploadDir();
    const filePath = path.join(UPLOAD_DIR, key);
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, data);
    return key;
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const filePath = path.join(UPLOAD_DIR, key);
      return await fs.readFile(filePath);
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const filePath = path.join(UPLOAD_DIR, key);
      await fs.unlink(filePath);
    } catch {
      // File may not exist
    }
  }

  async getUrl(key: string): Promise<string> {
    return `/api/uploads/file/${encodeURIComponent(key)}`;
  }
}

export class DatabaseStorageProvider implements StorageProvider {
  async save(key: string, data: Buffer, mimeType: string, uploadId?: string): Promise<string> {
    if (!uploadId) {
      throw new Error("uploadId required for database storage");
    }
    await prisma.upload.update({
      where: { id: uploadId },
      data: { fileData: new Uint8Array(data) },
    });
    return key;
  }

  async get(key: string, uploadId?: string): Promise<Buffer | null> {
    if (!uploadId) {
      const upload = await prisma.upload.findFirst({
        where: { storageKey: key },
        select: { fileData: true },
      });
      if (!upload?.fileData) return null;
      return Buffer.from(upload.fileData);
    }
    const upload = await prisma.upload.findUnique({
      where: { id: uploadId },
      select: { fileData: true },
    });
    if (!upload?.fileData) return null;
    return Buffer.from(upload.fileData);
  }

  async delete(key: string): Promise<void> {
    // Data is deleted when Upload record is deleted
  }

  async getUrl(key: string): Promise<string> {
    return `/api/uploads/file/${encodeURIComponent(key)}`;
  }
}

export function getStorageProvider(): StorageProvider {
  const storageType = process.env.UPLOAD_STORAGE || "local";

  if (storageType === "database") {
    return new DatabaseStorageProvider();
  }

  return new LocalStorageProvider();
}

export const storage = getStorageProvider();
