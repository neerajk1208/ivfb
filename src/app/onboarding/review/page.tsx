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
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Pill, Calendar, AlertCircle } from "lucide-react";

interface Medication {
  id: string;
  name: string;
  dosageAmount: number | null;
  dosageUnit: string | null;
  dosage: string | null;
  frequency: string;
  route: string | null;
  startDayOffset: number;
  durationDays: number;
  timeOfDay: string | null;
  exactTime: string | null;
  instructions: string | null;
}

interface Appointment {
  id: string;
  type: string;
  dayOffset: number;
  exactTime: string | null;
  notes: string | null;
  fasting: boolean;
  critical: boolean;
}

interface ProtocolData {
  id: string;
  cycleStartDate: string;
  medications: Medication[];
  appointments: Appointment[];
  notes: string | null;
  confidence?: {
    medications: string;
    appointments: string;
    cycleStartDate: string;
  };
  missingFields?: string[];
}

const TIME_OPTIONS = [
  { value: "morning", label: "Morning (7-9 AM)" },
  { value: "afternoon", label: "Afternoon (12-2 PM)" },
  { value: "evening", label: "Evening (6-8 PM)" },
  { value: "bedtime", label: "Bedtime (9-11 PM)" },
];

const DOSAGE_UNITS = [
  { value: "IU", label: "IU (International Units)" },
  { value: "mg", label: "mg (milligrams)" },
  { value: "mcg", label: "mcg (micrograms)" },
  { value: "mL", label: "mL (milliliters)" },
  { value: "pills", label: "pills" },
  { value: "patches", label: "patches" },
];

const FREQUENCY_OPTIONS = [
  { value: "once_daily", label: "Once daily" },
  { value: "twice_daily", label: "Twice daily" },
  { value: "three_times_daily", label: "Three times daily" },
  { value: "every_other_day", label: "Every other day" },
  { value: "single_dose", label: "Single dose" },
];

const ROUTE_OPTIONS = [
  { value: "subcutaneous", label: "Subcutaneous injection" },
  { value: "intramuscular", label: "Intramuscular injection" },
  { value: "oral", label: "Oral (pill)" },
  { value: "vaginal", label: "Vaginal" },
  { value: "patch", label: "Patch" },
];

const APPOINTMENT_TYPES = [
  { value: "BLOODWORK", label: "Bloodwork" },
  { value: "ULTRASOUND", label: "Ultrasound" },
  { value: "MONITORING", label: "Monitoring (BW + US)" },
  { value: "TRIGGER", label: "Trigger Shot" },
  { value: "RETRIEVAL", label: "Egg Retrieval" },
  { value: "TRANSFER", label: "Embryo Transfer" },
  { value: "CONSULTATION", label: "Consultation" },
  { value: "OTHER", label: "Other" },
];

function generateId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export default function ReviewPage() {
  const { status } = useSession();
  const router = useRouter();

  const [protocol, setProtocol] = useState<ProtocolData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"medications" | "appointments">("medications");

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
          dosageAmount: m.dosageAmount,
          dosageUnit: m.dosageUnit,
          dosage: m.dosage,
          frequency: m.frequency || "once_daily",
          route: m.route,
          startDayOffset: m.startDayOffset,
          durationDays: m.durationDays,
          timeOfDay: m.timeOfDay,
          exactTime: m.exactTime,
          instructions: m.instructions,
        })),
        appointments: (p.appointments || []).map((a: any) => ({
          id: a.id,
          type: a.type,
          dayOffset: a.dayOffset,
          exactTime: a.exactTime,
          notes: a.notes,
          fasting: a.fasting || false,
          critical: a.critical || false,
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

  const addMedication = () => {
    if (!protocol) return;
    const newMed: Medication = {
      id: generateId(),
      name: "",
      dosageAmount: null,
      dosageUnit: "IU",
      dosage: null,
      frequency: "once_daily",
      route: "subcutaneous",
      startDayOffset: 0,
      durationDays: 10,
      timeOfDay: "evening",
      exactTime: null,
      instructions: null,
    };
    setProtocol({
      ...protocol,
      medications: [...protocol.medications, newMed],
    });
  };

  const removeMedication = (id: string) => {
    if (!protocol) return;
    setProtocol({
      ...protocol,
      medications: protocol.medications.filter((m) => m.id !== id),
    });
  };

  const updateAppointment = (id: string, field: keyof Appointment, value: any) => {
    if (!protocol) return;
    setProtocol({
      ...protocol,
      appointments: protocol.appointments.map((a) =>
        a.id === id ? { ...a, [field]: value } : a
      ),
    });
  };

  const addAppointment = () => {
    if (!protocol) return;
    const newApt: Appointment = {
      id: generateId(),
      type: "MONITORING",
      dayOffset: 0,
      exactTime: "08:00",
      notes: null,
      fasting: false,
      critical: false,
    };
    setProtocol({
      ...protocol,
      appointments: [...protocol.appointments, newApt],
    });
  };

  const removeAppointment = (id: string) => {
    if (!protocol) return;
    setProtocol({
      ...protocol,
      appointments: protocol.appointments.filter((a) => a.id !== id),
    });
  };

  const handleConfirm = async () => {
    if (!protocol) return;

    if (!protocol.cycleStartDate) {
      setError("Please set your cycle start date");
      return;
    }

    if (protocol.medications.length === 0) {
      setError("Please add at least one medication");
      return;
    }

    const emptyMeds = protocol.medications.filter(m => !m.name.trim());
    if (emptyMeds.length > 0) {
      setError("Please fill in all medication names");
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
            dosageAmount: m.dosageAmount,
            dosageUnit: m.dosageUnit,
            dosage: m.dosage || (m.dosageAmount && m.dosageUnit ? `${m.dosageAmount} ${m.dosageUnit}` : null),
            frequency: m.frequency,
            route: m.route,
            startDayOffset: m.startDayOffset,
            durationDays: m.durationDays,
            timeOfDay: m.timeOfDay,
            exactTime: m.exactTime,
            instructions: m.instructions,
          })),
          appointments: protocol.appointments.map((a) => ({
            type: a.type,
            dayOffset: a.dayOffset,
            exactTime: a.exactTime,
            notes: a.notes,
            fasting: a.fasting,
            critical: a.critical,
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

  const extractionFailed = protocol.missingFields?.includes("extraction_failed");
  const noDataFound = protocol.missingFields?.includes("no_data_found");

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8">
      <div className="max-w-2xl w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold">Review Your Protocol</h1>
          <p className="text-muted-foreground">
            Verify medications and appointments
          </p>
        </div>

        {extractionFailed && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">
                  Couldn&apos;t extract protocol automatically
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Please add your medications and appointments manually below.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {!extractionFailed && noDataFound && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="pt-4">
              <p className="text-sm">
                No medications or appointments found. Please add them manually.
              </p>
            </CardContent>
          </Card>
        )}

        {!extractionFailed && !noDataFound && hasLowConfidence && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="pt-4">
              <p className="text-sm">
                Some details may need review. Please verify all information.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Cycle Start Date */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
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

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          <button
            className={`flex items-center gap-2 px-4 py-2 -mb-px ${
              activeTab === "medications"
                ? "border-b-2 border-primary font-medium"
                : "text-muted-foreground"
            }`}
            onClick={() => setActiveTab("medications")}
          >
            <Pill className="h-4 w-4" />
            Medications ({protocol.medications.length})
          </button>
          <button
            className={`flex items-center gap-2 px-4 py-2 -mb-px ${
              activeTab === "appointments"
                ? "border-b-2 border-primary font-medium"
                : "text-muted-foreground"
            }`}
            onClick={() => setActiveTab("appointments")}
          >
            <Calendar className="h-4 w-4" />
            Appointments ({protocol.appointments.length})
          </button>
        </div>

        {/* Medications Tab */}
        {activeTab === "medications" && (
          <Card className="border shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Medications</CardTitle>
                  <CardDescription>
                    Your medication schedule
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addMedication}
                  className="gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {protocol.medications.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No medications yet. Click &quot;Add&quot; to add your first medication.
                </p>
              )}

              {protocol.medications.map((med) => (
                <div
                  key={med.id}
                  className="space-y-4 pb-4 border-b last:border-0 last:pb-0"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{med.name || "New Medication"}</span>
                    <div className="flex items-center gap-2">
                      {med.dosageAmount && med.dosageUnit && (
                        <Badge variant="secondary">{med.dosageAmount} {med.dosageUnit}</Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => removeMedication(med.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Name */}
                    <div className="col-span-2 space-y-2">
                      <Label className="text-xs">Medication Name *</Label>
                      <Input
                        value={med.name}
                        placeholder="e.g., Gonal-F, Menopur, Cetrotide"
                        onChange={(e) =>
                          updateMedication(med.id, "name", e.target.value)
                        }
                      />
                    </div>

                    {/* Dosage Amount */}
                    <div className="space-y-2">
                      <Label className="text-xs">Dosage Amount</Label>
                      <Input
                        type="number"
                        step="any"
                        placeholder="e.g., 225"
                        value={med.dosageAmount || ""}
                        onChange={(e) =>
                          updateMedication(med.id, "dosageAmount", e.target.value ? parseFloat(e.target.value) : null)
                        }
                      />
                    </div>

                    {/* Dosage Unit */}
                    <div className="space-y-2">
                      <Label className="text-xs">Unit</Label>
                      <Select
                        value={med.dosageUnit || "IU"}
                        onValueChange={(v) =>
                          updateMedication(med.id, "dosageUnit", v)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DOSAGE_UNITS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Route */}
                    <div className="space-y-2">
                      <Label className="text-xs">Route</Label>
                      <Select
                        value={med.route || "subcutaneous"}
                        onValueChange={(v) =>
                          updateMedication(med.id, "route", v)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROUTE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Frequency */}
                    <div className="space-y-2">
                      <Label className="text-xs">Frequency</Label>
                      <Select
                        value={med.frequency}
                        onValueChange={(v) =>
                          updateMedication(med.id, "frequency", v)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FREQUENCY_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Start Day */}
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

                    {/* Duration */}
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

                    {/* Time of Day */}
                    <div className="space-y-2">
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

                    {/* Exact Time */}
                    <div className="space-y-2">
                      <Label className="text-xs">Exact Time (if specific)</Label>
                      <Input
                        type="time"
                        value={med.exactTime || ""}
                        onChange={(e) =>
                          updateMedication(med.id, "exactTime", e.target.value || null)
                        }
                      />
                    </div>

                    {/* Instructions */}
                    <div className="col-span-2 space-y-2">
                      <Label className="text-xs">Special Instructions</Label>
                      <Input
                        placeholder="e.g., Take with food, rotate injection sites"
                        value={med.instructions || ""}
                        onChange={(e) =>
                          updateMedication(med.id, "instructions", e.target.value || null)
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Appointments Tab */}
        {activeTab === "appointments" && (
          <Card className="border shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Appointments</CardTitle>
                  <CardDescription>
                    Bloodwork, ultrasounds, and procedures
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addAppointment}
                  className="gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {protocol.appointments.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No appointments yet. Click &quot;Add&quot; to add bloodwork, ultrasounds, or procedures.
                </p>
              )}

              {protocol.appointments.map((apt) => (
                <div
                  key={apt.id}
                  className="space-y-4 pb-4 border-b last:border-0 last:pb-0"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {APPOINTMENT_TYPES.find(t => t.value === apt.type)?.label || apt.type}
                    </span>
                    <div className="flex items-center gap-2">
                      {apt.critical && (
                        <Badge variant="destructive">Time-Critical</Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => removeAppointment(apt.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Type */}
                    <div className="space-y-2">
                      <Label className="text-xs">Type</Label>
                      <Select
                        value={apt.type}
                        onValueChange={(v) =>
                          updateAppointment(apt.id, "type", v)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {APPOINTMENT_TYPES.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Day */}
                    <div className="space-y-2">
                      <Label className="text-xs">Day</Label>
                      <Input
                        type="number"
                        min={0}
                        value={apt.dayOffset}
                        onChange={(e) =>
                          updateAppointment(
                            apt.id,
                            "dayOffset",
                            parseInt(e.target.value) || 0
                          )
                        }
                      />
                    </div>

                    {/* Time */}
                    <div className="space-y-2">
                      <Label className="text-xs">Time</Label>
                      <Input
                        type="time"
                        value={apt.exactTime || ""}
                        onChange={(e) =>
                          updateAppointment(apt.id, "exactTime", e.target.value || null)
                        }
                      />
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                      <Label className="text-xs">Notes</Label>
                      <Input
                        placeholder="Any special notes"
                        value={apt.notes || ""}
                        onChange={(e) =>
                          updateAppointment(apt.id, "notes", e.target.value || null)
                        }
                      />
                    </div>

                    {/* Fasting */}
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={apt.fasting}
                        onCheckedChange={(v) =>
                          updateAppointment(apt.id, "fasting", v)
                        }
                      />
                      <Label className="text-xs">Fasting required</Label>
                    </div>

                    {/* Critical */}
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={apt.critical}
                        onCheckedChange={(v) =>
                          updateAppointment(apt.id, "critical", v)
                        }
                      />
                      <Label className="text-xs">Time-critical</Label>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

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
            disabled={isConfirming || protocol.medications.length === 0}
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
