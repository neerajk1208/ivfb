"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pill, Calendar, Clock, AlertTriangle } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";

interface Dose {
  doseNumber: number;
  timeOfDay: string | null;
  exactTime: string | null;
}

interface Medication {
  id: string;
  name: string;
  dosageAmount: number | null;
  dosageUnit: string | null;
  unitStrength: string | null;
  dosage: string | null;
  frequency: string;
  route: string | null;
  startDate: string | null;
  endDate: string | null;
  startDayOffset: number;
  durationDays: number;
  timeOfDay: string | null;
  exactTime: string | null;
  doses: Dose[] | null;
  instructions: string | null;
}

interface Appointment {
  id: string;
  type: string;
  date: string | null;
  dayOffset: number;
  exactTime: string | null;
  notes: string | null;
  fasting: boolean;
  critical: boolean;
}

interface PlanData {
  cycleStartDate: string;
  medications: Medication[];
  appointments: Appointment[];
}

const FREQUENCY_LABELS: Record<string, string> = {
  once_daily: "Once daily",
  twice_daily: "Twice daily",
  three_times_daily: "Three times daily",
  every_other_day: "Every other day",
  single_dose: "Single dose",
};

const ROUTE_LABELS: Record<string, string> = {
  subcutaneous: "Subcutaneous injection",
  intramuscular: "Intramuscular injection",
  oral: "Oral",
  vaginal: "Vaginal",
  patch: "Patch",
};

const TIME_LABELS: Record<string, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  bedtime: "Bedtime",
};

const APPOINTMENT_LABELS: Record<string, string> = {
  BLOODWORK: "Bloodwork",
  ULTRASOUND: "Ultrasound",
  MONITORING: "Monitoring (BW + US)",
  TRIGGER: "Trigger Shot",
  RETRIEVAL: "Egg Retrieval",
  TRANSFER: "Embryo Transfer",
  CONSULTATION: "Consultation",
  OTHER: "Other",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export default function PlanPage() {
  const { status } = useSession();
  const router = useRouter();

  const [plan, setPlan] = useState<PlanData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"medications" | "appointments">("medications");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
      return;
    }

    if (status === "authenticated") {
      fetchPlan();
    }
  }, [status, router]);

  const fetchPlan = async () => {
    try {
      const res = await fetch("/api/plan");
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 404) {
          setError("No active protocol found. Please complete onboarding first.");
        } else {
          setError(data.error || "Failed to load plan");
        }
        return;
      }

      setPlan({
        cycleStartDate: data.data.cycleStartDate.split("T")[0],
        medications: data.data.medications,
        appointments: data.data.appointments,
      });
    } catch (err) {
      setError("Failed to load plan");
    } finally {
      setIsLoading(false);
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center pb-20">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="max-w-lg mx-auto px-4 py-8">
          <h1 className="text-2xl font-semibold mb-4">Your Protocol</h1>
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">{error}</p>
            </CardContent>
          </Card>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!plan) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Your Protocol</h1>
          <p className="text-muted-foreground">
            Cycle started {formatDate(plan.cycleStartDate)}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          <button
            className={`flex items-center gap-2 px-4 py-2 -mb-px transition-colors ${
              activeTab === "medications"
                ? "border-b-2 border-primary font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("medications")}
          >
            <Pill className="h-4 w-4" />
            Medications ({plan.medications.length})
          </button>
          <button
            className={`flex items-center gap-2 px-4 py-2 -mb-px transition-colors ${
              activeTab === "appointments"
                ? "border-b-2 border-primary font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("appointments")}
          >
            <Calendar className="h-4 w-4" />
            Appointments ({plan.appointments.length})
          </button>
        </div>

        {/* Medications Tab */}
        {activeTab === "medications" && (
          <div className="space-y-4">
            {plan.medications.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground text-center">
                    No medications in your protocol
                  </p>
                </CardContent>
              </Card>
            ) : (
              plan.medications.map((med) => (
                <Card key={med.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{med.name}</CardTitle>
                        {med.dosageAmount && med.dosageUnit && (
                          <CardDescription>
                            {med.dosageAmount} {med.dosageUnit}
                            {med.unitStrength && ` (${med.unitStrength} each)`}
                          </CardDescription>
                        )}
                      </div>
                      {med.route && (
                        <Badge variant="secondary" className="text-xs">
                          {ROUTE_LABELS[med.route] || med.route}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Frequency</p>
                        <p>{FREQUENCY_LABELS[med.frequency] || med.frequency}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Duration</p>
                        <p>
                          {formatDate(med.startDate)} – {formatDate(med.endDate)}
                        </p>
                      </div>
                    </div>

                    {/* Timing */}
                    {med.doses && med.doses.length > 0 ? (
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">Timing</p>
                        <div className="space-y-1">
                          {(med.doses as Dose[]).map((dose) => (
                            <div key={dose.doseNumber} className="flex items-center gap-2 text-sm">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>
                                Dose {dose.doseNumber}: {TIME_LABELS[dose.timeOfDay || ""] || dose.timeOfDay}
                                {dose.exactTime && ` (${formatTime(dose.exactTime)})`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : med.timeOfDay || med.exactTime ? (
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">Timing</p>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>
                            {TIME_LABELS[med.timeOfDay || ""] || med.timeOfDay}
                            {med.exactTime && ` (${formatTime(med.exactTime)})`}
                          </span>
                        </div>
                      </div>
                    ) : null}

                    {med.instructions && (
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">Instructions</p>
                        <p className="text-sm">{med.instructions}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Appointments Tab */}
        {activeTab === "appointments" && (
          <div className="space-y-4">
            {plan.appointments.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground text-center">
                    No appointments in your protocol
                  </p>
                </CardContent>
              </Card>
            ) : (
              plan.appointments.map((apt) => (
                <Card key={apt.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">
                        {APPOINTMENT_LABELS[apt.type] || apt.type}
                      </CardTitle>
                      <div className="flex gap-1.5">
                        {apt.fasting && (
                          <Badge variant="outline" className="text-xs">
                            Fasting
                          </Badge>
                        )}
                        {apt.critical && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Critical
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{formatDate(apt.date)}</span>
                        <span className="text-muted-foreground">(Day {apt.dayOffset})</span>
                      </div>
                      {apt.exactTime && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{formatTime(apt.exactTime)}</span>
                        </div>
                      )}
                    </div>

                    {apt.notes && (
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">Notes</p>
                        <p className="text-sm">{apt.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        <p className="text-xs text-center text-muted-foreground px-4">
          IVF Buddy is for informational support only. Always follow your
          clinic&apos;s instructions.
        </p>
      </div>

      <BottomNav />
    </div>
  );
}
