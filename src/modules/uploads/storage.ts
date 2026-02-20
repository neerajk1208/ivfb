import { promises as fs } from "fs";
import path from "path";

export interface StorageProvider {
  save(key: string, data: Buffer, mimeType: string): Promise<string>;
  get(key: string): Promise<Buffer | null>;
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

export class S3StorageProvider implements StorageProvider {
  private bucket: string;
  private region: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET || "";
    this.region = process.env.S3_REGION || "us-east-1";
  }

  async save(key: string, data: Buffer, mimeType: string): Promise<string> {
    // S3 implementation would go here
    // For MVP, we'll throw if S3 is selected but not properly configured
    throw new Error("S3 storage not implemented yet. Use UPLOAD_STORAGE=local");
  }

  async get(key: string): Promise<Buffer | null> {
    throw new Error("S3 storage not implemented yet. Use UPLOAD_STORAGE=local");
  }

  async delete(key: string): Promise<void> {
    throw new Error("S3 storage not implemented yet. Use UPLOAD_STORAGE=local");
  }

  async getUrl(key: string): Promise<string> {
    throw new Error("S3 storage not implemented yet. Use UPLOAD_STORAGE=local");
  }
}

export function getStorageProvider(): StorageProvider {
  const storageType = process.env.UPLOAD_STORAGE || "local";

  if (storageType === "s3") {
    return new S3StorageProvider();
  }

  return new LocalStorageProvider();
}

export const storage = getStorageProvider();
