"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Medication {
  id: string;
  name: string;
  dosage: string | null;
  startDayOffset: number;
  durationDays: number;
  timeOfDay: string | null;
}

interface ProtocolData {
  id: string;
  cycleStartDate: string;
  medications: Medication[];
  notes: string | null;
  confidence?: {
    medications: string;
    cycleStartDate: string;
  };
  missingFields?: string[];
}

const TIME_OPTIONS = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "bedtime", label: "Bedtime" },
];

export default function ReviewPage() {
  const { status } = useSession();
  const router = useRouter();

  const [protocol, setProtocol] = useState<ProtocolData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
      return;
    }

    if (status === "authenticated") {
      fetchProtocol();
    }
  }, [status, router]);

  const fetchProtocol = async () => {
    try {
      const res = await fetch("/api/protocol/current");
      const data = await res.json();

      if (!res.ok || !data.data) {
        router.push("/onboarding");
        return;
      }

      const p = data.data;
      setProtocol({
        id: p.id,
        cycleStartDate: p.cycleStartDate.split("T")[0],
        medications: p.medications.map((m: any) => ({
          id: m.id,
          name: m.name,
          dosage: m.dosage,
          startDayOffset: m.startDayOffset,
          durationDays: m.durationDays,
          timeOfDay: m.timeOfDay,
        })),
        notes: p.notes,
        confidence: p.structuredData?.confidence,
        missingFields: p.structuredData?.missingFields,
      });
    } catch (err) {
      setError("Failed to load protocol");
    } finally {
      setIsLoading(false);
    }
  };

  const updateMedication = (id: string, field: keyof Medication, value: any) => {
    if (!protocol) return;
    setProtocol({
      ...protocol,
      medications: protocol.medications.map((m) =>
        m.id === id ? { ...m, [field]: value } : m
      ),
    });
  };

  const handleConfirm = async () => {
    if (!protocol) return;

    if (!protocol.cycleStartDate) {
      setError("Please set your cycle start date");
      return;
    }

    setError("");
    setIsConfirming(true);

    try {
      const res = await fetch("/api/protocol/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          protocolPlanId: protocol.id,
          cycleStartDate: protocol.cycleStartDate,
          medications: protocol.medications.map((m) => ({
            name: m.name,
            dosage: m.dosage,
            startDayOffset: m.startDayOffset,
            durationDays: m.durationDays,
            timeOfDay: m.timeOfDay,
            customTime: null,
            instructions: null,
          })),
          notes: protocol.notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to confirm protocol");
      }

      router.push("/today");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsConfirming(false);
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!protocol) {
    return null;
  }

  const hasLowConfidence =
    protocol.confidence?.medications === "low" ||
    protocol.confidence?.cycleStartDate === "low";

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold">Review Your Protocol</h1>
          <p className="text-muted-foreground">
            Please verify the details are correct
          </p>
        </div>

        {hasLowConfidence && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="pt-4">
              <p className="text-sm">
                Some details may need your review. Please check the highlighted
                fields.
              </p>
            </CardContent>
          </Card>
        )}

        {protocol.missingFields && protocol.missingFields.length > 0 && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-4">
              <p className="text-sm text-destructive">
                Missing information:{" "}
                {protocol.missingFields.join(", ")}
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Cycle Start Date</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="date"
              value={protocol.cycleStartDate}
              onChange={(e) =>
                setProtocol({ ...protocol, cycleStartDate: e.target.value })
              }
            />
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Medications</CardTitle>
            <CardDescription>
              {protocol.medications.length} medication
              {protocol.medications.length !== 1 ? "s" : ""} found
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {protocol.medications.map((med, index) => (
              <div
                key={med.id}
                className="space-y-4 pb-4 border-b last:border-0 last:pb-0"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{med.name || "Unnamed"}</span>
                  {med.dosage && (
                    <Badge variant="secondary">{med.dosage}</Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Name</Label>
                    <Input
                      value={med.name}
                      onChange={(e) =>
                        updateMedication(med.id, "name", e.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Dosage</Label>
                    <Input
                      value={med.dosage || ""}
                      onChange={(e) =>
                        updateMedication(med.id, "dosage", e.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Start Day</Label>
                    <Input
                      type="number"
                      min={0}
                      value={med.startDayOffset}
                      onChange={(e) =>
                        updateMedication(
                          med.id,
                          "startDayOffset",
                          parseInt(e.target.value) || 0
                        )
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Duration (days)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={med.durationDays}
                      onChange={(e) =>
                        updateMedication(
                          med.id,
                          "durationDays",
                          parseInt(e.target.value) || 1
                        )
                      }
                    />
                  </div>

                  <div className="col-span-2 space-y-2">
                    <Label className="text-xs">Time of Day</Label>
                    <Select
                      value={med.timeOfDay || "evening"}
                      onValueChange={(v) =>
                        updateMedication(med.id, "timeOfDay", v)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => router.push("/onboarding")}
          >
            Start Over
          </Button>
          <Button
            className="flex-1"
            onClick={handleConfirm}
            disabled={isConfirming}
          >
            {isConfirming ? "Setting up..." : "Confirm & Continue"}
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          IVF Buddy is for informational support only. Always follow your
          clinic&apos;s instructions.
        </p>
      </div>
    </div>
  );
}
