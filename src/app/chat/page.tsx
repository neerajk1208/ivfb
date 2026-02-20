"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, 
  ChevronRight, 
  Send, 
  Pill, 
  Calendar,
  MessageCircle,
  Clock,
} from "lucide-react";
import { format, addDays, subDays, isToday, isTomorrow, isYesterday } from "date-fns";

interface Message {
  id: string;
  sender: "SYSTEM" | "USER" | "BUDDY";
  type: string;
  content: string;
  meta: any;
  createdAt: string;
}

interface DailyContext {
  cycleDayIndex: number;
  medications: Array<{
    id: string;
    name: string;
    dosageAmount: number | null;
    dosageUnit: string | null;
    dosage: string | null;
    timeOfDay: string | null;
    exactTime: string | null;
  }>;
  appointments: Array<{
    id: string;
    type: string;
    exactTime: string | null;
    fasting: boolean;
    critical: boolean;
    notes: string | null;
  }>;
}

function formatDateLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMM d");
}

function formatTime(dateString: string): string {
  return format(new Date(dateString), "h:mm a");
}

function getAppointmentLabel(type: string): string {
  const labels: Record<string, string> = {
    BLOODWORK: "Bloodwork",
    ULTRASOUND: "Ultrasound",
    MONITORING: "Monitoring",
    TRIGGER: "Trigger Shot",
    RETRIEVAL: "Egg Retrieval",
    TRANSFER: "Embryo Transfer",
  };
  return labels[type] || type;
}

export default function ChatPage() {
  const { status } = useSession();
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [messages, setMessages] = useState<Message[]>([]);
  const [context, setContext] = useState<DailyContext | null>(null);
  const [remainingMessages, setRemainingMessages] = useState(30);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchData();
    }
  }, [status, selectedDate]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchData = async () => {
    setIsLoading(true);
    setError("");

    try {
      const dateParam = format(selectedDate, "yyyy-MM-dd");
      
      const [messagesRes, contextRes] = await Promise.all([
        fetch(`/api/chat/messages?date=${dateParam}`),
        fetch(`/api/chat/context?date=${dateParam}`),
      ]);

      const messagesData = await messagesRes.json();
      const contextData = await contextRes.json();

      if (messagesRes.ok && messagesData.data) {
        setMessages(messagesData.data.messages || []);
      }

      if (contextRes.ok && contextData.data) {
        setContext(contextData.data.context);
        setRemainingMessages(contextData.data.remainingMessages);
      }
    } catch (err) {
      setError("Failed to load chat");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isSending) return;

    const content = inputValue.trim();
    setInputValue("");
    setIsSending(true);
    setError("");

    // Optimistic update
    const tempUserMsg: Message = {
      id: `temp_${Date.now()}`,
      sender: "USER",
      type: "MESSAGE",
      content,
      meta: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send message");
      }

      // Replace temp message with real ones
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== tempUserMsg.id);
        const newMessages = [];
        if (data.data.userMessage) {
          newMessages.push(data.data.userMessage);
        }
        if (data.data.buddyReply) {
          newMessages.push(data.data.buddyReply);
        }
        return [...filtered, ...newMessages];
      });

      setRemainingMessages(data.data.remainingMessages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const goToPreviousDay = () => setSelectedDate((d) => subDays(d, 1));
  const goToNextDay = () => setSelectedDate((d) => addDays(d, 1));
  const goToToday = () => setSelectedDate(new Date());

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={goToPreviousDay}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <button
              onClick={goToToday}
              className="text-center"
            >
              <div className="font-semibold">{formatDateLabel(selectedDate)}</div>
              <div className="text-xs text-muted-foreground">
                {format(selectedDate, "EEEE, MMM d")}
              </div>
            </button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={goToNextDay}
              disabled={isToday(selectedDate)}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Context Banner */}
      {context && (
        <div className="bg-primary/5 border-b">
          <div className="max-w-2xl mx-auto px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary" className="font-semibold">
                Day {context.cycleDayIndex}
              </Badge>
              {context.appointments.some((a) => a.critical) && (
                <Badge variant="destructive">Important Today</Badge>
              )}
            </div>

            {context.medications.length > 0 && (
              <div className="flex items-start gap-2 text-sm mb-1">
                <Pill className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <div className="text-muted-foreground">
                  {context.medications.map((med, i) => (
                    <span key={med.id}>
                      {med.name}
                      {med.dosageAmount && med.dosageUnit && ` ${med.dosageAmount} ${med.dosageUnit}`}
                      {med.timeOfDay && ` (${med.timeOfDay})`}
                      {i < context.medications.length - 1 && " • "}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {context.appointments.length > 0 && (
              <div className="flex items-start gap-2 text-sm">
                <Calendar className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <div className="text-muted-foreground">
                  {context.appointments.map((apt, i) => (
                    <span key={apt.id}>
                      {getAppointmentLabel(apt.type)}
                      {apt.exactTime && ` @ ${apt.exactTime}`}
                      {apt.fasting && " (fasting)"}
                      {i < context.appointments.length - 1 && " • "}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {context.medications.length === 0 && context.appointments.length === 0 && (
              <p className="text-sm text-muted-foreground">No medications or appointments today</p>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No messages yet today</p>
              <p className="text-sm mt-1">
                Your reminders will appear here
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === "USER" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                  msg.sender === "USER"
                    ? "bg-primary text-primary-foreground"
                    : msg.sender === "BUDDY"
                    ? "bg-muted"
                    : "bg-card border"
                }`}
              >
                {msg.sender === "SYSTEM" && (
                  <div className="flex items-center gap-1.5 mb-1">
                    {msg.type === "REMINDER" && <Pill className="h-3.5 w-3.5" />}
                    {msg.type === "APPOINTMENT" && <Calendar className="h-3.5 w-3.5" />}
                    {msg.type === "CHECKIN" && <MessageCircle className="h-3.5 w-3.5" />}
                    <span className="text-xs font-medium text-muted-foreground">
                      {msg.type === "REMINDER" && "Medication Reminder"}
                      {msg.type === "APPOINTMENT" && "Appointment"}
                      {msg.type === "CHECKIN" && "Check-in"}
                      {msg.type === "INFO" && "Info"}
                    </span>
                  </div>
                )}
                <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                <div className={`text-xs mt-1 ${
                  msg.sender === "USER" ? "text-primary-foreground/70" : "text-muted-foreground"
                }`}>
                  <Clock className="h-3 w-3 inline mr-1" />
                  {formatTime(msg.createdAt)}
                </div>
              </div>
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t bg-card sticky bottom-0">
        <div className="max-w-2xl mx-auto px-4 py-3">
          {error && (
            <p className="text-sm text-destructive mb-2">{error}</p>
          )}
          
          <div className="flex items-center gap-2">
            <Input
              placeholder="Type a message..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={isSending || remainingMessages === 0}
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={!inputValue.trim() || isSending || remainingMessages === 0}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>{remainingMessages} messages remaining today</span>
            <button
              onClick={() => router.push("/today")}
              className="hover:underline"
            >
              View tasks →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
