"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, FileText, Image, AlertCircle } from "lucide-react";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ACCEPTED_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "IMAGE",
  "image/jpg": "IMAGE",
  "image/png": "IMAGE",
  "image/webp": "IMAGE",
  "image/heic": "IMAGE",
  "image/heif": "IMAGE",
};

const COMMON_TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Phoenix", label: "Arizona (MST)" },
  { value: "Pacific/Honolulu", label: "Hawaii (HST)" },
  { value: "America/Anchorage", label: "Alaska (AKT)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
];

export default function OnboardingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [timezone, setTimezone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [checkingCycle, setCheckingCycle] = useState(true);
  
  // Upload state
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");

  useEffect(() => {
    // Auto-detect timezone from browser
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const isInList = COMMON_TIMEZONES.some(tz => tz.value === detected);
      setTimezone(isInList ? detected : "America/Los_Angeles");
    } catch {
      setTimezone("America/Los_Angeles");
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
      return;
    }

    if (status === "authenticated") {
      fetch("/api/protocol/current")
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data?.medications?.length > 0) {
            router.push("/today");
          } else {
            setCheckingCycle(false);
          }
        })
        .catch(() => {
          setCheckingCycle(false);
        });
    }
  }, [status, router]);

  const validateFile = (file: File): string | null => {
    if (!(file.type in ACCEPTED_TYPES)) {
      return "Please upload a PDF or image file (JPG, PNG, WEBP, HEIC)";
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File is too large. Maximum size is 10MB (yours is ${(file.size / 1024 / 1024).toFixed(1)}MB)`;
    }
    return null;
  };

  const processFile = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setIsUploading(true);
    setUploadProgress("Uploading...");

    try {
      const kind = ACCEPTED_TYPES[file.type];

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

      const { uploadId } = createData.data;

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
      setUploadProgress("Analyzing your protocol...");

      const finalizeRes = await fetch("/api/uploads/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId }),
      });

      const contentType = finalizeRes.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        throw new Error("Server error. Please try again.");
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
      setUploadProgress("");
    }
  };

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
    if (droppedFile) {
      processFile(droppedFile);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  if (status === "loading" || checkingCycle) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const handleProfileSubmit = async () => {
    setError("");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timezone,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to save profile");
        return;
      }

      setStep(2);
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold">Welcome to IVF Buddy</h1>
          <p className="text-muted-foreground">
            {step === 1
              ? "Let's get you set up"
              : "How would you like to add your protocol?"}
          </p>
        </div>

        <div className="flex justify-center space-x-2 mb-4">
          <div
            className={`h-2 w-16 rounded-full ${
              step >= 1 ? "bg-primary" : "bg-muted"
            }`}
          />
          <div
            className={`h-2 w-16 rounded-full ${
              step >= 2 ? "bg-primary" : "bg-muted"
            }`}
          />
        </div>

        {step === 1 && (
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Your Timezone</CardTitle>
              <CardDescription>
                We&apos;ll use this to send you reminders at the right time
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="timezone">Select your timezone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button
                onClick={handleProfileSubmit}
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? "Saving..." : "Continue"}
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Upload Your Protocol</CardTitle>
              <CardDescription>
                Share your clinic&apos;s medication plan and we&apos;ll set up your reminders automatically
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isUploading || isProcessing ? (
                <div className="py-12 text-center space-y-4">
                  <div className="w-12 h-12 mx-auto border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <div className="space-y-1">
                    <p className="font-medium">{uploadProgress}</p>
                    <p className="text-sm text-muted-foreground">
                      {isProcessing 
                        ? "This may take a moment..." 
                        : "Please wait..."}
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer hover:border-primary/50 hover:bg-primary/5 ${
                    isDragging
                      ? "border-primary bg-primary/10"
                      : "border-muted-foreground/25"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById("file-input")?.click()}
                >
                  <input
                    id="file-input"
                    type="file"
                    className="hidden"
                    accept=".pdf,image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
                    onChange={handleFileSelect}
                  />
                  
                  <div className="space-y-4">
                    <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                      <Upload className="w-8 h-8 text-primary" />
                    </div>
                    
                    <div className="space-y-2">
                      <p className="font-medium">
                        {isDragging ? "Drop your file here" : "Drop your protocol here"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        or <span className="text-primary font-medium">browse files</span>
                      </p>
                    </div>

                    <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" />
                        PDF
                      </span>
                      <span className="flex items-center gap-1">
                        <Image className="w-3.5 h-3.5" />
                        JPG, PNG, WEBP, HEIC
                      </span>
                    </div>
                    
                    <p className="text-xs text-muted-foreground">
                      Maximum file size: 10MB
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {!isUploading && !isProcessing && (
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={() => setStep(1)}
                >
                  Back
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-center text-muted-foreground px-4">
          IVF Buddy is for informational support only. Always follow your clinic&apos;s instructions.
        </p>
      </div>
    </div>
  );
}
