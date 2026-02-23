"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";

interface PaywallProps {
  onSubscribed?: () => void;
}

const FEATURES = [
  "Medication reminders (push + SMS)",
  "AI chat buddy for support",
  "Google Calendar sync",
  "Daily check-ins",
  "Appointment reminders",
];

export function Paywall({ onSubscribed }: PaywallProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubscribe = async () => {
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to start checkout");
        return;
      }

      if (data.data?.url) {
        window.location.href = data.data.url;
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Activate Your Reminders</CardTitle>
        <CardDescription>
          Subscribe to start receiving medication reminders and access all features
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center">
          <div className="text-4xl font-bold">$12</div>
          <div className="text-muted-foreground">/month</div>
        </div>

        <ul className="space-y-3">
          {FEATURES.map((feature) => (
            <li key={feature} className="flex items-center gap-2">
              <Check className="h-5 w-5 text-primary flex-shrink-0" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        <Button
          onClick={handleSubscribe}
          disabled={isLoading}
          className="w-full"
          size="lg"
        >
          {isLoading ? "Loading..." : "Subscribe Now"}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Cancel anytime. Subscription auto-pauses when your cycle ends.
        </p>
      </CardContent>
    </Card>
  );
}
