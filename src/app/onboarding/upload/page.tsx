"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ACCEPTED_TYPES = {
  "application/pdf": "PDF",
  "image/jpeg": "IMAGE",
  "image/png": "IMAGE",
  "image/heic": "IMAGE",
  "image/heif": "IMAGE",
} as const;

export default function UploadPage() {
  const { status } = useSession();
  const router = useRouter();

  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type in ACCEPTED_TYPES) {
      setFile(droppedFile);
      setError("");
    } else {
      setError("Please upload a PDF or image file (JPG, PNG, HEIC)");
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type in ACCEPTED_TYPES) {
      setFile(selectedFile);
      setError("");
    } else {
      setError("Please upload a PDF or image file (JPG, PNG, HEIC)");
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setError("");
    setIsUploading(true);

    try {
      const kind = ACCEPTED_TYPES[file.type as keyof typeof ACCEPTED_TYPES];

      const createRes = await fetch("/api/uploads/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          mimeType: file.type,
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) {
        throw new Error(createData.error || "Failed to initiate upload");
      }

      const { uploadId, storageKey } = createData.data;

      const formData = new FormData();
      formData.append("file", file);
      formData.append("uploadId", uploadId);

      const uploadRes = await fetch("/api/uploads/file", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const uploadData = await uploadRes.json();
        throw new Error(uploadData.error || "Failed to upload file");
      }

      setIsUploading(false);
      setIsProcessing(true);

      const finalizeRes = await fetch("/api/uploads/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId }),
      });

      // Handle non-JSON responses (e.g., timeout errors)
      const contentType = finalizeRes.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        console.error("Non-JSON response:", await finalizeRes.text());
        throw new Error("Server error. Please try again or enter your protocol manually.");
      }

      const finalizeData = await finalizeRes.json();
      if (!finalizeRes.ok) {
        throw new Error(finalizeData.error || "Failed to process file");
      }

      router.push("/onboarding/review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsUploading(false);
      setIsProcessing(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold">Upload Your Protocol</h1>
          <p className="text-muted-foreground">
            Upload your clinic&apos;s medication plan
          </p>
        </div>

        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Upload Document</CardTitle>
            <CardDescription>
              PDF or photo of your protocol instructions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {file ? (
                <div className="space-y-2">
                  <svg
                    className="w-10 h-10 mx-auto text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFile(null)}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <svg
                    className="w-10 h-10 mx-auto text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <p className="text-sm text-muted-foreground">
                    Drag and drop your file here, or
                  </p>
                  <label className="cursor-pointer">
                    <span className="text-primary hover:underline">
                      browse files
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,image/jpeg,image/png,image/heic,image/heif"
                      onChange={handleFileSelect}
                    />
                  </label>
                </div>
              )}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {isProcessing && (
              <div className="text-center space-y-2">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Analyzing your protocol...
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => router.push("/onboarding")}
              >
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={handleUpload}
                disabled={!file || isUploading || isProcessing}
              >
                {isUploading
                  ? "Uploading..."
                  : isProcessing
                  ? "Processing..."
                  : "Continue"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-center text-muted-foreground">
          Your documents are processed securely and never shared.
        </p>
      </div>
    </div>
  );
}
