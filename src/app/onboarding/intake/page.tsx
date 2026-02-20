"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MedicationEntry {
  id: string;
  name: string;
  dosage: string;
  startDayOffset: number;
  durationDays: number;
  timeOfDay: string;
}

const TIME_OPTIONS = [
  { value: "morning", label: "Morning (9am)" },
  { value: "afternoon", label: "Afternoon (1pm)" },
  { value: "evening", label: "Evening (8:30pm)" },
  { value: "bedtime", label: "Bedtime (10pm)" },
];

export default function IntakePage() {
  const { status } = useSession();
  const router = useRouter();

  const [cycleStartDate, setCycleStartDate] = useState("");
  const [medications, setMedications] = useState<MedicationEntry[]>([
    {
      id: "1",
      name: "",
      dosage: "",
      startDayOffset: 0,
      durationDays: 10,
      timeOfDay: "evening",
    },
  ]);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  const addMedication = () => {
    setMedications([
      ...medications,
      {
        id: Date.now().toString(),
        name: "",
        dosage: "",
        startDayOffset: 0,
        durationDays: 10,
        timeOfDay: "evening",
      },
    ]);
  };

  const removeMedication = (id: string) => {
    if (medications.length > 1) {
      setMedications(medications.filter((m) => m.id !== id));
    }
  };

  const updateMedication = (id: string, field: keyof MedicationEntry, value: any) => {
    setMedications(
      medications.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const handleSubmit = async () => {
    setError("");

    const validMeds = medications.filter((m) => m.name.trim());
    if (!cycleStartDate) {
      setError("Please enter your cycle start date");
      return;
    }
    if (validMeds.length === 0) {
      setError("Please add at least one medication");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/protocol/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycleStartDate,
          medications: validMeds.map((m) => ({
            name: m.name,
            dosage: m.dosage || null,
            startDayOffset: m.startDayOffset,
            durationDays: m.durationDays,
            timeOfDay: m.timeOfDay || null,
            customTime: null,
            instructions: null,
          })),
          milestones: [],
          notes: notes || null,
          source: "INTAKE",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save protocol");
      }

      router.push("/onboarding/review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
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
    <div className="min-h-screen flex flex-col items-center px-4 py-8">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold">Enter Your Protocol</h1>
          <p className="text-muted-foreground">
            Add your medications and we&apos;ll set up your reminders
          </p>
        </div>

        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Cycle Start Date</CardTitle>
            <CardDescription>
              When does (or did) your cycle begin?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              type="date"
              value={cycleStartDate}
              onChange={(e) => setCycleStartDate(e.target.value)}
            />
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Medications</CardTitle>
            <CardDescription>
              Add each medication from your protocol
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {medications.map((med, index) => (
              <div
                key={med.id}
                className="space-y-4 pb-4 border-b last:border-0 last:pb-0"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    Medication {index + 1}
                  </span>
                  {medications.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMedication(med.id)}
                    >
                      Remove
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label>Medication Name</Label>
                    <Input
                      placeholder="e.g., Gonal-F"
                      value={med.name}
                      onChange={(e) =>
                        updateMedication(med.id, "name", e.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Dosage</Label>
                    <Input
                      placeholder="e.g., 150 IU"
                      value={med.dosage}
                      onChange={(e) =>
                        updateMedication(med.id, "dosage", e.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Time of Day</Label>
                    <Select
                      value={med.timeOfDay}
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

                  <div className="space-y-2">
                    <Label>Start Day</Label>
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
                    <p className="text-xs text-muted-foreground">
                      Day 0 = cycle start
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Duration (days)</Label>
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
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              className="w-full"
              onClick={addMedication}
            >
              + Add Another Medication
            </Button>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Notes (Optional)</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Any additional notes about your protocol..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
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
            Back
          </Button>
          <Button
            className="flex-1"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Continue"}
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          You can edit these details on the next screen.
        </p>
      </div>
    </div>
  );
}
