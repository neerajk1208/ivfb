"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Pill, Calendar, AlertCircle, CalendarPlus, Bell, CheckCircle2, Check, Sparkles } from "lucide-react";
import { Paywall } from "@/components/Paywall";

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

function formatDateFromOffset(cycleStartDate: string, offsetDays: number): string {
  if (!cycleStartDate) return "";
  const date = new Date(cycleStartDate);
  date.setDate(date.getDate() + offsetDays);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getDateFromOffset(cycleStartDate: string, offsetDays: number): string {
  if (!cycleStartDate) return "";
  const date = new Date(cycleStartDate);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().split("T")[0];
}

function getOffsetFromDate(cycleStartDate: string, targetDate: string): number {
  if (!cycleStartDate || !targetDate) return 0;
  const start = new Date(cycleStartDate);
  const target = new Date(targetDate);
  const diffTime = target.getTime() - start.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

function getDosesForFrequency(frequency: string): number {
  switch (frequency) {
    case "twice_daily": return 2;
    case "three_times_daily": return 3;
    default: return 1;
  }
}

function getDefaultDoses(frequency: string): Dose[] | null {
  const count = getDosesForFrequency(frequency);
  if (count === 1) return null;
  
  const defaults: Record<number, Dose[]> = {
    2: [
      { doseNumber: 1, timeOfDay: "morning", exactTime: "08:00" },
      { doseNumber: 2, timeOfDay: "evening", exactTime: "20:00" },
    ],
    3: [
      { doseNumber: 1, timeOfDay: "morning", exactTime: "08:00" },
      { doseNumber: 2, timeOfDay: "afternoon", exactTime: "14:00" },
      { doseNumber: 3, timeOfDay: "evening", exactTime: "20:00" },
    ],
  };
  return defaults[count] || null;
}

function ReviewPageContent() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [protocol, setProtocol] = useState<ProtocolData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"medications" | "appointments">("medications");
  const [showPushStep, setShowPushStep] = useState(false);
  const [showCalendarStep, setShowCalendarStep] = useState(false);
  const [includeMedications, setIncludeMedications] = useState(false);
  const [pushPermissionState, setPushPermissionState] = useState<"prompt" | "granted" | "denied" | "unsupported">("prompt");
  const [isRequestingPush, setIsRequestingPush] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [shouldAutoConfirm, setShouldAutoConfirm] = useState(false);
  const [autoConfirmStatus, setAutoConfirmStatus] = useState<string | null>(null);
  
  // Confirmation progress state
  const [showConfirmProgress, setShowConfirmProgress] = useState(false);
  const [confirmProgressStep, setConfirmProgressStep] = useState(0);
  const [confirmError, setConfirmError] = useState("");

  const CONFIRM_STEPS = [
    { id: 1, label: "Creating your care plan" },
    { id: 2, label: "Scheduling medication reminders" },
    { id: 3, label: "Adding appointments" },
    { id: 4, label: "Finalizing your schedule" },
  ];

  // Helper to show the appropriate post-confirm step
  const showNextStepAfterConfirm = () => {
    // Check if push notifications are already granted
    const pushAlreadyGranted = 
      typeof Notification !== "undefined" && 
      Notification.permission === "granted";
    
    if (pushAlreadyGranted) {
      // Skip push step, go directly to calendar step
      setShowPushStep(false);
      setShowCalendarStep(true);
    } else {
      setShowPushStep(true);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
      return;
    }

    if (status === "authenticated") {
      fetchProtocol();
      
      const checkoutStatus = searchParams.get("checkout");
      if (checkoutStatus === "success") {
        setIsSubscribed(true);
        setShowPaywall(false);
        setShouldAutoConfirm(true);
        window.history.replaceState({}, "", "/onboarding/review");
      } else {
        checkSubscription();
      }
    }
  }, [status, router, searchParams]);

  useEffect(() => {
    if (shouldAutoConfirm && protocol && isSubscribed && !isConfirming) {
      setShouldAutoConfirm(false);
      setAutoConfirmStatus("confirming");
      handleConfirmAfterPayment();
    }
  }, [shouldAutoConfirm, protocol, isSubscribed, isConfirming]);

  const advanceConfirmSteps = async (startStep: number, endStep: number) => {
    for (let i = startStep; i <= endStep; i++) {
      setConfirmProgressStep(i);
      if (i < endStep) {
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }
  };

  const handleConfirmAfterPayment = async () => {
    if (!protocol) {
      setAutoConfirmStatus("error: no protocol");
      return;
    }
    
    setShowConfirmProgress(true);
    setConfirmProgressStep(1);
    setConfirmError("");
    setIsConfirming(true);
    
    try {
      // Start API call and advance steps in parallel
      const confirmPromise = fetch("/api/protocol/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          protocolPlanId: protocol.id,
          cycleStartDate: protocol.cycleStartDate,
          medications: protocol.medications.map((m) => ({
            name: m.name,
            dosageAmount: m.dosageAmount,
            dosageUnit: m.dosageUnit,
            unitStrength: m.unitStrength,
            dosage: m.dosage || (m.dosageAmount && m.dosageUnit ? `${m.dosageAmount} ${m.dosageUnit}` : null),
            frequency: m.frequency,
            route: m.route,
            startDate: m.startDate,
            endDate: m.endDate,
            startDayOffset: m.startDayOffset,
            durationDays: m.durationDays,
            timeOfDay: m.timeOfDay,
            exactTime: m.exactTime,
            doses: m.doses,
            instructions: m.instructions,
          })),
          appointments: protocol.appointments.map((a) => ({
            type: a.type,
            date: a.date,
            dayOffset: a.dayOffset,
            exactTime: a.exactTime,
            notes: a.notes,
            fasting: a.fasting,
            critical: a.critical,
          })),
          notes: protocol.notes,
        }),
      });

      // Advance through steps while waiting
      await advanceConfirmSteps(1, 3);
      
      const res = await confirmPromise;
      const data = await res.json();
      
      if (!res.ok) {
        setAutoConfirmStatus(`error: ${data.error || "API error"}`);
        throw new Error(data.error || "Failed to confirm protocol");
      }
      
      // Final step
      setConfirmProgressStep(4);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setAutoConfirmStatus("success");
      setShowConfirmProgress(false);
      showNextStepAfterConfirm();
    } catch (err) {
      setAutoConfirmStatus(`catch: ${err instanceof Error ? err.message : "unknown"}`);
      setConfirmError(err instanceof Error ? err.message : "Failed to confirm protocol");
    } finally {
      setIsConfirming(false);
    }
  };

  const checkSubscription = async () => {
    try {
      const res = await fetch("/api/stripe/status");
      const data = await res.json();
      if (res.ok && data.data) {
        setIsSubscribed(data.data.isActive);
      } else {
        setIsSubscribed(false);
      }
    } catch {
      setIsSubscribed(false);
    }
  };

  const fetchProtocol = async () => {
    try {
      const res = await fetch("/api/protocol/current");
      const data = await res.json();

      if (!res.ok || !data.data) {
        router.push("/onboarding");
        return;
      }

      const p = data.data;
      
      // If protocol is already confirmed, redirect to /today
      // (whether coming from checkout or not - no need to re-confirm)
      if (p.status === "CONFIRMED") {
        router.push("/today");
        return;
      }
      
      setProtocol({
        id: p.id,
        cycleStartDate: p.cycleStartDate.split("T")[0],
        medications: p.medications.map((m: any) => ({
          id: m.id,
          name: m.name,
          dosageAmount: m.dosageAmount,
          dosageUnit: m.dosageUnit,
          unitStrength: m.unitStrength,
          dosage: m.dosage,
          frequency: m.frequency || "once_daily",
          route: m.route,
          startDate: m.startDate ? m.startDate.split("T")[0] : null,
          endDate: m.endDate ? m.endDate.split("T")[0] : null,
          startDayOffset: m.startDayOffset,
          durationDays: m.durationDays,
          timeOfDay: m.timeOfDay,
          exactTime: m.exactTime,
          doses: m.doses || null,
          instructions: m.instructions,
        })),
        appointments: (p.appointments || []).map((a: any) => ({
          id: a.id,
          type: a.type,
          date: a.date ? a.date.split("T")[0] : null,
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

  const updateMedication = (id: string, updates: Partial<Medication>) => {
    setProtocol((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        medications: prev.medications.map((m) =>
          m.id === id ? { ...m, ...updates } : m
        ),
      };
    });
  };

  const addMedication = () => {
    if (!protocol) return;
    const newMed: Medication = {
      id: generateId(),
      name: "",
      dosageAmount: null,
      dosageUnit: "IU",
      unitStrength: null,
      dosage: null,
      frequency: "once_daily",
      route: "subcutaneous",
      startDate: protocol.cycleStartDate,
      endDate: null,
      startDayOffset: 0,
      durationDays: 10,
      timeOfDay: "evening",
      exactTime: null,
      doses: null,
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

  const updateAppointment = (id: string, updates: Partial<Appointment>) => {
    setProtocol((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        appointments: prev.appointments.map((a) =>
          a.id === id ? { ...a, ...updates } : a
        ),
      };
    });
  };

  const addAppointment = () => {
    if (!protocol) return;
    const newApt: Appointment = {
      id: generateId(),
      type: "MONITORING",
      date: protocol.cycleStartDate,
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

    if (!isSubscribed) {
      setShowPaywall(true);
      return;
    }

    setError("");
    setShowConfirmProgress(true);
    setConfirmProgressStep(1);
    setConfirmError("");
    setIsConfirming(true);

    try {
      // Start API call and advance steps in parallel
      const confirmPromise = fetch("/api/protocol/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          protocolPlanId: protocol.id,
          cycleStartDate: protocol.cycleStartDate,
          medications: protocol.medications.map((m) => ({
            name: m.name,
            dosageAmount: m.dosageAmount,
            dosageUnit: m.dosageUnit,
            unitStrength: m.unitStrength,
            dosage: m.dosage || (m.dosageAmount && m.dosageUnit ? `${m.dosageAmount} ${m.dosageUnit}` : null),
            frequency: m.frequency,
            route: m.route,
            startDate: m.startDate,
            endDate: m.endDate,
            startDayOffset: m.startDayOffset,
            durationDays: m.durationDays,
            timeOfDay: m.timeOfDay,
            exactTime: m.exactTime,
            doses: m.doses,
            instructions: m.instructions,
          })),
          appointments: protocol.appointments.map((a) => ({
            type: a.type,
            date: a.date,
            dayOffset: a.dayOffset,
            exactTime: a.exactTime,
            notes: a.notes,
            fasting: a.fasting,
            critical: a.critical,
          })),
          notes: protocol.notes,
        }),
      });

      // Advance through steps while waiting
      await advanceConfirmSteps(1, 3);
      
      const res = await confirmPromise;
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to confirm protocol");
      }

      // Final step
      setConfirmProgressStep(4);
      await new Promise(resolve => setTimeout(resolve, 1000));

      setShowConfirmProgress(false);
      showNextStepAfterConfirm();
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsConfirming(false);
    }
  };

  const handleConnectCalendar = () => {
    const returnTo = includeMedications
      ? "/today?calendar=connected&includeMeds=1"
      : "/today?calendar=connected";
    window.location.href = `/api/calendar/auth?returnTo=${encodeURIComponent(returnTo)}`;
  };

  const handleSkipCalendar = () => {
    router.push("/today");
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Confirmation progress screen
  if (showConfirmProgress) {
    const allComplete = confirmProgressStep > CONFIRM_STEPS.length;
    
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-gradient-to-b from-background to-primary/5">
        <div className="max-w-md w-full space-y-8">
          {/* Animated icon */}
          <div className="flex justify-center">
            <div className="relative">
              {/* Sparkle effects */}
              <div className="absolute -top-2 -right-2">
                <Sparkles 
                  className="w-6 h-6 text-primary/40 animate-pulse" 
                  style={{ animationDuration: '2s' }}
                />
              </div>
              <div className="absolute -bottom-1 -left-2">
                <Sparkles 
                  className="w-5 h-5 text-primary/30 animate-pulse" 
                  style={{ animationDuration: '2.5s', animationDelay: '0.5s' }}
                />
              </div>
              {/* Main icon */}
              <div className="w-24 h-24 bg-primary/10 rounded-2xl flex items-center justify-center">
                <Bell className="w-12 h-12 text-primary" />
                {/* Completion checkmark */}
                {confirmProgressStep >= CONFIRM_STEPS.length && (
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center animate-in zoom-in duration-300">
                    <Check className="w-5 h-5 text-white" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-semibold">
              {confirmProgressStep >= CONFIRM_STEPS.length ? "You're All Set!" : "Setting Up Your Reminders"}
            </h1>
            <p className="text-muted-foreground">
              {confirmProgressStep >= CONFIRM_STEPS.length 
                ? "Your personalized care plan is ready" 
                : "Creating your personalized care plan..."}
            </p>
          </div>

          {/* Progress steps */}
          <Card className="border-0 shadow-lg bg-card/80 backdrop-blur">
            <CardContent className="pt-6 pb-4">
              <div className="space-y-4">
                {CONFIRM_STEPS.map((step) => {
                  const isComplete = confirmProgressStep > step.id;
                  const isCurrent = confirmProgressStep === step.id;
                  const isPending = confirmProgressStep < step.id;

                  return (
                    <div 
                      key={step.id}
                      className={`flex items-center gap-4 transition-all duration-500 ${
                        isPending ? 'opacity-40' : 'opacity-100'
                      }`}
                    >
                      {/* Step indicator */}
                      <div className={`
                        w-8 h-8 rounded-full flex items-center justify-center shrink-0
                        transition-all duration-500
                        ${isComplete 
                          ? 'bg-green-500 text-white' 
                          : isCurrent 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted text-muted-foreground'
                        }
                      `}>
                        {isComplete ? (
                          <Check className="w-4 h-4" />
                        ) : isCurrent ? (
                          <div className="w-3 h-3 bg-primary-foreground rounded-full animate-pulse" />
                        ) : (
                          <span className="text-xs font-medium">{step.id}</span>
                        )}
                      </div>

                      {/* Step label */}
                      <span className={`text-sm transition-all duration-300 ${
                        isComplete 
                          ? 'text-green-600 font-medium' 
                          : isCurrent 
                            ? 'text-foreground font-medium' 
                            : 'text-muted-foreground'
                      }`}>
                        {step.label}
                        {isCurrent && (
                          <span className="inline-block ml-1 animate-pulse">...</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Error state */}
          {confirmError && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p className="text-sm text-destructive">{confirmError}</p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setShowConfirmProgress(false);
                        setConfirmError("");
                        setConfirmProgressStep(0);
                        setIsConfirming(false);
                      }}
                    >
                      Try again
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          {!confirmError && protocol && (
            <div className="flex justify-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Pill className="w-4 h-4" />
                {protocol.medications.length} medications
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {protocol.appointments.length} appointments
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!protocol) {
    return null;
  }

  if (showPaywall) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center space-y-2 mb-6">
            <h1 className="text-2xl font-semibold">Your Protocol is Ready!</h1>
            <p className="text-muted-foreground">
              We found {protocol.medications.length} medications and {protocol.appointments.length} appointments
            </p>
          </div>
          <Paywall />
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => setShowPaywall(false)}
          >
            Go back and edit
          </Button>
        </div>
      </div>
    );
  }

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const checkPushSupport = () => {
    if (typeof window === "undefined") return false;
    if (!("Notification" in window)) return false;
    if (!("serviceWorker" in navigator)) return false;
    if (!("PushManager" in window)) return false;
    return true;
  };

  const handleEnablePush = async () => {
    if (!checkPushSupport()) {
      setPushPermissionState("unsupported");
      return;
    }

    setIsRequestingPush(true);
    try {
      const permission = await Notification.requestPermission();
      
      if (permission !== "granted") {
        setPushPermissionState("denied");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""
        ),
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      setPushPermissionState("granted");
      setTimeout(() => {
        setShowPushStep(false);
        setShowCalendarStep(true);
      }, 1500);
    } catch (err) {
      console.error("Push subscription error:", err);
      setPushPermissionState("denied");
    } finally {
      setIsRequestingPush(false);
    }
  };

  const handleSkipPush = () => {
    setShowPushStep(false);
    setShowCalendarStep(true);
  };

  const isIOS = () => {
    if (typeof window === "undefined") return false;
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  };

  const isPWA = () => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true
    );
  };

  if (showPushStep) {
    const iosNoPWA = isIOS() && !isPWA();
    const pushSupported = checkPushSupport();

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4">
              {pushPermissionState === "granted" ? (
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              ) : (
                <Bell className="w-8 h-8 text-primary" />
              )}
            </div>
            <h1 className="text-2xl font-semibold">
              {pushPermissionState === "granted" 
                ? "Notifications Enabled!" 
                : "Never Miss a Dose"}
            </h1>
            <p className="text-muted-foreground">
              {pushPermissionState === "granted"
                ? "You'll receive timely reminders for medications and appointments."
                : "Get timely reminders for your medications, appointments, and important updates."}
            </p>
          </div>

          {pushPermissionState !== "granted" && (
            <Card>
              <CardContent className="pt-6">
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Pill className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span>Medication reminders at the right time</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Calendar className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span>Appointment alerts so you&apos;re never late</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Bell className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span>Daily check-in prompts to track your journey</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          )}

          {iosNoPWA && pushPermissionState !== "granted" && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-4">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> On iPhone, notifications only work when IVF Buddy is installed on your home screen. 
                  If you skipped that step, you can still continue without notifications.
                </p>
              </CardContent>
            </Card>
          )}

          {pushPermissionState === "denied" && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="pt-4">
                <p className="text-sm text-destructive">
                  Notifications were blocked. You can enable them later in your browser or device settings.
                </p>
              </CardContent>
            </Card>
          )}

          {!pushSupported && pushPermissionState !== "granted" && (
            <Card className="border-muted">
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">
                  Push notifications aren&apos;t supported on this browser. You can still use IVF Buddy - 
                  check the app for your daily reminders.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {pushPermissionState === "granted" ? (
              <Button 
                onClick={() => {
                  setShowPushStep(false);
                  setShowCalendarStep(true);
                }} 
                className="w-full"
              >
                Continue
              </Button>
            ) : pushSupported && !iosNoPWA ? (
              <>
                <Button 
                  onClick={handleEnablePush} 
                  className="w-full"
                  disabled={isRequestingPush}
                >
                  {isRequestingPush ? (
                    "Enabling..."
                  ) : (
                    <>
                      <Bell className="w-4 h-4 mr-2" />
                      Enable Notifications
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleSkipPush}
                  variant="ghost"
                  className="w-full text-muted-foreground"
                >
                  Skip for now
                </Button>
              </>
            ) : (
              <Button
                onClick={handleSkipPush}
                className="w-full"
              >
                Continue
              </Button>
            )}
          </div>

          <p className="text-xs text-center text-muted-foreground">
            You can change notification settings anytime in Settings
          </p>
        </div>
      </div>
    );
  }

  if (showCalendarStep) {
    const formatDateString = (dateStr: string) => {
      const [, month, day] = dateStr.split("-").map(Number);
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${months[month - 1]} ${day}`;
    };

    const formatTime = (time: string) => {
      const [h, m] = time.split(":").map(Number);
      const ampm = h >= 12 ? "PM" : "AM";
      const hour = h % 12 || 12;
      return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
    };

    const typeLabels: Record<string, string> = {
      BLOODWORK: "Bloodwork",
      ULTRASOUND: "Ultrasound",
      MONITORING: "Monitoring",
      TRIGGER: "Trigger Shot",
      RETRIEVAL: "Egg Retrieval",
      TRANSFER: "Embryo Transfer",
    };

    const timeOfDayLabels: Record<string, string> = {
      morning: "Morning",
      afternoon: "Afternoon",
      evening: "Evening",
      bedtime: "Bedtime",
    };
    
    const appointmentPreviews = protocol.appointments.map((apt) => {
      const dateStr = apt.date 
        ? formatDateString(apt.date)
        : `Day ${apt.dayOffset}`;
      const timeStr = apt.exactTime ? formatTime(apt.exactTime) : "";
      return `${typeLabels[apt.type] || apt.type} (${dateStr}${timeStr ? `, ${timeStr}` : ""})`;
    });

    const getMedicationPreviews = () => {
      const previews: string[] = [];
      for (const med of protocol.medications) {
        const doses = med.doses as Array<{ doseNumber: number; timeOfDay?: string; exactTime?: string }> | null;
        const durationText = med.durationDays === 1 ? "1 day" : `${med.durationDays} days`;
        const startDateStr = med.startDate ? formatDateString(med.startDate) : `Day ${med.startDayOffset}`;
        
        if (doses && doses.length > 0) {
          for (const dose of doses) {
            const timeStr = dose.exactTime 
              ? formatTime(dose.exactTime)
              : timeOfDayLabels[dose.timeOfDay || ""] || "";
            const doseLabel = doses.length > 1 ? ` [Dose ${dose.doseNumber}/${doses.length}]` : "";
            previews.push(`${med.name}${doseLabel} - ${timeStr} (${startDateStr}, ${durationText})`);
          }
        } else {
          const timeStr = med.exactTime 
            ? formatTime(med.exactTime)
            : timeOfDayLabels[med.timeOfDay || ""] || "";
          previews.push(`${med.name} - ${timeStr} (${startDateStr}, ${durationText})`);
        }
      }
      return previews;
    };

    const medicationPreviews = includeMedications ? getMedicationPreviews() : [];

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <CalendarPlus className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold">Add to Google Calendar?</h1>
            <p className="text-muted-foreground">
              We can add your appointments and reminders to your calendar
            </p>
          </div>

          {appointmentPreviews.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Appointments ({appointmentPreviews.length})</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-1.5 text-sm max-h-64 overflow-y-auto">
                  {appointmentPreviews.map((preview, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{preview}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeMeds"
                checked={includeMedications}
                onCheckedChange={(checked) => setIncludeMedications(!!checked)}
              />
              <Label htmlFor="includeMeds" className="text-sm cursor-pointer">
                Also add medication reminders
              </Label>
            </div>

            {includeMedications && medicationPreviews.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Medication Reminders ({medicationPreviews.length})</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="space-y-1.5 text-sm max-h-64 overflow-y-auto">
                    {medicationPreviews.map((preview, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Pill className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="truncate">{preview}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <Button onClick={handleConnectCalendar} className="w-full">
              <CalendarPlus className="w-4 h-4 mr-2" />
              Connect Google Calendar
            </Button>
            <Button
              onClick={handleSkipCalendar}
              variant="ghost"
              className="w-full text-muted-foreground"
            >
              Skip for now
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            You can always connect your calendar later in Settings
          </p>
        </div>
      </div>
    );
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
                          updateMedication(med.id, { name: e.target.value })
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
                          updateMedication(med.id, { dosageAmount: e.target.value ? parseFloat(e.target.value) : null })
                        }
                      />
                    </div>

                    {/* Dosage Unit */}
                    <div className="space-y-2">
                      <Label className="text-xs">Unit</Label>
                      <Select
                        value={med.dosageUnit || "IU"}
                        onValueChange={(v) =>
                          updateMedication(med.id, { dosageUnit: v })
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

                    {/* Unit Strength (for pills, etc.) */}
                    {(med.dosageUnit === "pills" || med.dosageUnit === "patches") && (
                      <div className="space-y-2">
                        <Label className="text-xs">Per-unit strength</Label>
                        <Input
                          placeholder="e.g., 2mg"
                          value={med.unitStrength || ""}
                          onChange={(e) =>
                            updateMedication(med.id, { unitStrength: e.target.value || null })
                          }
                        />
                      </div>
                    )}

                    {/* Route */}
                    <div className="space-y-2">
                      <Label className="text-xs">Route</Label>
                      <Select
                        value={med.route || "subcutaneous"}
                        onValueChange={(v) =>
                          updateMedication(med.id, { route: v })
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
                        onValueChange={(v) => {
                          const doseCount = getDosesForFrequency(v);
                          updateMedication(med.id, {
                            frequency: v,
                            doses: doseCount > 1 ? getDefaultDoses(v) : null,
                          });
                        }}
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

                    {/* Start Date */}
                    <div className="space-y-2">
                      <Label className="text-xs">Start Date</Label>
                      <Input
                        type="date"
                        value={med.startDate || ""}
                        onChange={(e) => {
                          const newDate = e.target.value || null;
                          const updates: Partial<Medication> = { startDate: newDate };
                          if (protocol?.cycleStartDate && newDate) {
                            updates.startDayOffset = getOffsetFromDate(protocol.cycleStartDate, newDate);
                          }
                          updateMedication(med.id, updates);
                        }}
                      />
                    </div>

                    {/* End Date */}
                    <div className="space-y-2">
                      <Label className="text-xs">
                        End Date
                        {med.startDate && med.endDate && (
                          <span className="ml-1 text-muted-foreground">
                            ({getOffsetFromDate(med.startDate, med.endDate) + 1} {getOffsetFromDate(med.startDate, med.endDate) === 0 ? "day" : "days"})
                          </span>
                        )}
                      </Label>
                      <Input
                        type="date"
                        value={med.endDate || ""}
                        onChange={(e) => {
                          const newDate = e.target.value || null;
                          const updates: Partial<Medication> = { endDate: newDate };
                          if (med.startDate && newDate) {
                            updates.durationDays = Math.max(1, getOffsetFromDate(med.startDate, newDate) + 1);
                          }
                          updateMedication(med.id, updates);
                        }}
                      />
                    </div>

                    {/* Time fields - single dose */}
                    {getDosesForFrequency(med.frequency) === 1 && (
                      <>
                        <div className="space-y-2">
                          <Label className="text-xs">Time of Day</Label>
                          <Select
                            value={med.timeOfDay || "evening"}
                            onValueChange={(v) =>
                              updateMedication(med.id, { timeOfDay: v })
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
                          <Label className="text-xs">Exact Time</Label>
                          <Input
                            type="time"
                            value={med.exactTime || ""}
                            onChange={(e) =>
                              updateMedication(med.id, { exactTime: e.target.value || null })
                            }
                          />
                        </div>
                      </>
                    )}

                    {/* Time fields - multiple doses */}
                    {getDosesForFrequency(med.frequency) > 1 && (
                      <div className="col-span-2 space-y-3">
                        <Label className="text-xs">Dose Times</Label>
                        {(med.doses || getDefaultDoses(med.frequency) || []).map((dose, idx) => (
                          <div key={dose.doseNumber} className="flex items-center gap-2 pl-2 border-l-2 border-primary/30">
                            <span className="text-xs text-muted-foreground w-16">Dose {dose.doseNumber}</span>
                            <Select
                              value={dose.timeOfDay || "morning"}
                              onValueChange={(v) => {
                                const currentDoses = med.doses || getDefaultDoses(med.frequency) || [];
                                const updated = currentDoses.map((d, i) =>
                                  i === idx ? { ...d, timeOfDay: v } : d
                                );
                                updateMedication(med.id, { doses: updated });
                              }}
                            >
                              <SelectTrigger className="w-32">
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
                            <Input
                              type="time"
                              className="w-28"
                              value={dose.exactTime || ""}
                              onChange={(e) => {
                                const currentDoses = med.doses || getDefaultDoses(med.frequency) || [];
                                const updated = currentDoses.map((d, i) =>
                                  i === idx ? { ...d, exactTime: e.target.value || null } : d
                                );
                                updateMedication(med.id, { doses: updated });
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Instructions */}
                    <div className="col-span-2 space-y-2">
                      <Label className="text-xs">Special Instructions</Label>
                      <Input
                        placeholder="e.g., Take with food, rotate injection sites"
                        value={med.instructions || ""}
                        onChange={(e) =>
                          updateMedication(med.id, { instructions: e.target.value || null })
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
                          updateAppointment(apt.id, { type: v })
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
                      <Label className="text-xs">
                        Date
                        {protocol.cycleStartDate && apt.date && (
                          <span className="ml-1 text-muted-foreground">
                            (Day {getOffsetFromDate(protocol.cycleStartDate, apt.date)})
                          </span>
                        )}
                      </Label>
                      <Input
                        type="date"
                        value={apt.date || ""}
                        onChange={(e) => {
                          const newDate = e.target.value || null;
                          const updates: Partial<Appointment> = { date: newDate };
                          if (protocol?.cycleStartDate && newDate) {
                            updates.dayOffset = getOffsetFromDate(protocol.cycleStartDate, newDate);
                          }
                          updateAppointment(apt.id, updates);
                        }}
                      />
                    </div>

                    {/* Time */}
                    <div className="space-y-2">
                      <Label className="text-xs">Time</Label>
                      <Input
                        type="time"
                        value={apt.exactTime || ""}
                        onChange={(e) =>
                          updateAppointment(apt.id, { exactTime: e.target.value || null })
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
                          updateAppointment(apt.id, { notes: e.target.value || null })
                        }
                      />
                    </div>

                    {/* Fasting */}
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={apt.fasting}
                        onCheckedChange={(v) =>
                          updateAppointment(apt.id, { fasting: v })
                        }
                      />
                      <Label className="text-xs">Fasting required</Label>
                    </div>

                    {/* Critical */}
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={apt.critical}
                        onCheckedChange={(v) =>
                          updateAppointment(apt.id, { critical: v })
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
        {autoConfirmStatus && autoConfirmStatus.startsWith("error") && (
          <p className="text-sm text-destructive text-center">Debug: {autoConfirmStatus}</p>
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

export default function ReviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>}>
      <ReviewPageContent />
    </Suspense>
  );
}
