"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";

interface Task {
  id: string;
  kind: string;
  label: string;
  dueAt: string;
  status: string;
}

interface TodayData {
  cycleDayIndex: number;
  cycleStartDate: string;
  tasks: Task[];
  upcomingTasks: Task[];
  todayCheckIn: {
    mood: number | null;
    symptoms: string[];
    note: string | null;
  } | null;
}

const MOOD_OPTIONS = [
  { value: 1, label: "Rough", emoji: "😔" },
  { value: 2, label: "Low", emoji: "😕" },
  { value: 3, label: "Okay", emoji: "😐" },
  { value: 4, label: "Good", emoji: "🙂" },
  { value: 5, label: "Great", emoji: "😊" },
];

const SYMPTOM_OPTIONS = [
  "Bloating",
  "Cramps",
  "Fatigue",
  "Headache",
  "Nausea",
  "Mood swings",
  "Hot flashes",
  "Anxiety",
];

export default function TodayPage() {
  const { status } = useSession();
  const router = useRouter();

  const [data, setData] = useState<TodayData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkInSubmitted, setCheckInSubmitted] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
      return;
    }

    if (status === "authenticated") {
      fetchTodayData();
    }
  }, [status, router]);

  const fetchTodayData = async () => {
    try {
      const res = await fetch("/api/today");
      const result = await res.json();

      if (!res.ok) {
        if (result.error === "No active protocol") {
          router.push("/onboarding");
          return;
        }
        throw new Error(result.error);
      }

      setData(result.data);

      if (result.data.todayCheckIn) {
        setSelectedMood(result.data.todayCheckIn.mood);
        setSelectedSymptoms(result.data.todayCheckIn.symptoms || []);
        setNote(result.data.todayCheckIn.note || "");
        setCheckInSubmitted(true);
      }
    } catch (err) {
      console.error("Failed to load today data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckIn = async () => {
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/checkin/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mood: selectedMood,
          symptoms: selectedSymptoms,
          note: note || null,
          source: "APP",
        }),
      });

      if (res.ok) {
        setCheckInSubmitted(true);
      }
    } catch (err) {
      console.error("Check-in failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSymptom = (symptom: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(symptom)
        ? prev.filter((s) => s !== symptom)
        : [...prev, symptom]
    );
  };

  const handleTaskToggle = async (taskId: string, done: boolean) => {
    try {
      await fetch("/api/tasks/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, done }),
      });

      setData((prev) =>
        prev
          ? {
              ...prev,
              tasks: prev.tasks.map((t) =>
                t.id === taskId ? { ...t, status: done ? "DONE" : "PENDING" } : t
              ),
            }
          : null
      );
    } catch (err) {
      console.error("Task toggle failed:", err);
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Today</h1>
            <p className="text-muted-foreground">
              Cycle Day {data.cycleDayIndex}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/settings")}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </Button>
        </div>

        {data.tasks.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Today&apos;s Tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start space-x-3 p-2 rounded-lg hover:bg-muted/50"
                >
                  <Checkbox
                    checked={task.status === "DONE"}
                    onCheckedChange={(checked) =>
                      handleTaskToggle(task.id, checked === true)
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm ${
                        task.status === "DONE"
                          ? "line-through text-muted-foreground"
                          : ""
                      }`}
                    >
                      {task.label}
                    </p>
                    {task.dueAt && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(task.dueAt).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {task.kind === "REMINDER"
                      ? "💊"
                      : task.kind === "CHECKIN"
                      ? "💛"
                      : "📋"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {checkInSubmitted ? "Today's Check-in" : "How are you feeling?"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              {MOOD_OPTIONS.map((mood) => (
                <button
                  key={mood.value}
                  onClick={() => setSelectedMood(mood.value)}
                  disabled={checkInSubmitted}
                  className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
                    selectedMood === mood.value
                      ? "bg-primary/10 ring-2 ring-primary"
                      : "hover:bg-muted"
                  } ${checkInSubmitted ? "opacity-70" : ""}`}
                >
                  <span className="text-2xl">{mood.emoji}</span>
                  <span className="text-xs text-muted-foreground mt-1">
                    {mood.label}
                  </span>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Any symptoms today?
              </p>
              <div className="flex flex-wrap gap-2">
                {SYMPTOM_OPTIONS.map((symptom) => (
                  <Badge
                    key={symptom}
                    variant={
                      selectedSymptoms.includes(symptom)
                        ? "default"
                        : "secondary"
                    }
                    className={`cursor-pointer ${
                      checkInSubmitted ? "pointer-events-none" : ""
                    }`}
                    onClick={() => toggleSymptom(symptom)}
                  >
                    {symptom}
                  </Badge>
                ))}
              </div>
            </div>

            <Textarea
              placeholder="Any notes? (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={checkInSubmitted}
              rows={2}
            />

            {!checkInSubmitted && (
              <Button
                className="w-full"
                onClick={handleCheckIn}
                disabled={isSubmitting || !selectedMood}
              >
                {isSubmitting ? "Saving..." : "Save Check-in"}
              </Button>
            )}

            {checkInSubmitted && (
              <p className="text-sm text-center text-muted-foreground">
                Check-in saved 💛
              </p>
            )}
          </CardContent>
        </Card>

        {data.upcomingTasks.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Coming Up</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.upcomingTasks.slice(0, 5).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between py-2"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">{task.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(task.dueAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-center text-muted-foreground px-4">
          IVF Buddy is for informational support only. Always follow your
          clinic&apos;s instructions.
        </p>
      </div>
    </div>
  );
}
