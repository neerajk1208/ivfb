"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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

interface UserSettings {
  email: string;
  name: string | null;
  timezone: string;
  phoneE164: string | null;
  smsConsent: boolean;
  quietHours: { start: string; end: string } | null;
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
      return;
    }

    if (status === "authenticated") {
      fetchSettings();
    }
  }, [status, router]);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/user/settings");
      const data = await res.json();

      if (res.ok && data.data) {
        setSettings(data.data);
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setIsSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timezone: settings.timezone,
          phoneE164: settings.phoneE164,
          smsConsent: settings.smsConsent,
          quietHours: settings.quietHours,
        }),
      });

      if (res.ok) {
        setMessage("Settings saved");
        setTimeout(() => setMessage(""), 3000);
      } else {
        const data = await res.json();
        setMessage(data.error || "Failed to save");
      }
    } catch (err) {
      setMessage("Something went wrong");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);

    try {
      const res = await fetch("/api/user/delete", {
        method: "DELETE",
      });

      if (res.ok) {
        await signOut({ callbackUrl: "/" });
      } else {
        setMessage("Failed to delete account");
        setShowDeleteDialog(false);
      }
    } catch (err) {
      setMessage("Something went wrong");
      setShowDeleteDialog(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatPhoneForDisplay = (phone: string | null): string => {
    if (!phone) return "";
    if (phone.startsWith("+1") && phone.length === 12) {
      return `(${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8)}`;
    }
    return phone;
  };

  const parsePhoneInput = (input: string): string => {
    const digits = input.replace(/\D/g, "");
    if (digits.length === 10) {
      return `+1${digits}`;
    }
    if (digits.length === 11 && digits.startsWith("1")) {
      return `+${digits}`;
    }
    return input.startsWith("+") ? input : `+${digits}`;
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!settings) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/today")}>
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Button>
          <h1 className="text-2xl font-semibold">Settings</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Email</Label>
              <p className="text-sm">{settings.email}</p>
            </div>
            {settings.name && (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Name</Label>
                <p className="text-sm">{settings.name}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Notifications</CardTitle>
            <CardDescription>
              Manage your SMS reminders and check-ins
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={formatPhoneForDisplay(settings.phoneE164)}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    phoneE164: parsePhoneInput(e.target.value),
                  })
                }
              />
            </div>

            <div className="flex items-center space-x-3">
              <Checkbox
                id="smsConsent"
                checked={settings.smsConsent}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, smsConsent: checked === true })
                }
              />
              <Label htmlFor="smsConsent" className="text-sm cursor-pointer">
                Receive SMS reminders and check-ins
              </Label>
            </div>

            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select
                value={settings.timezone}
                onValueChange={(v) => setSettings({ ...settings, timezone: v })}
              >
                <SelectTrigger>
                  <SelectValue />
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

            <div className="space-y-2">
              <Label>Quiet Hours (optional)</Label>
              <div className="flex items-center space-x-2">
                <Input
                  type="time"
                  value={settings.quietHours?.start || "21:00"}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      quietHours: {
                        start: e.target.value,
                        end: settings.quietHours?.end || "08:00",
                      },
                    })
                  }
                  className="w-32"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="time"
                  value={settings.quietHours?.end || "08:00"}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      quietHours: {
                        start: settings.quietHours?.start || "21:00",
                        end: e.target.value,
                      },
                    })
                  }
                  className="w-32"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                No SMS will be sent during these hours
              </p>
            </div>

            <div className="pt-4 border-t">
              <Button
                variant="outline"
                className="w-full"
                disabled={isSendingTest || !settings.smsConsent}
                onClick={async () => {
                  setIsSendingTest(true);
                  setMessage("");
                  try {
                    const res = await fetch("/api/test/sms", { method: "POST" });
                    const data = await res.json();
                    if (res.ok) {
                      setMessage("Test SMS sent! Check your phone.");
                    } else {
                      setMessage(data.error || "Failed to send test SMS");
                    }
                  } catch {
                    setMessage("Failed to send test SMS");
                  } finally {
                    setIsSendingTest(false);
                  }
                }}
              >
                {isSendingTest ? "Sending..." : "Send Test SMS"}
              </Button>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Send a test message to verify SMS is working
              </p>
            </div>
          </CardContent>
        </Card>

        {message && (
          <p className="text-sm text-center text-muted-foreground">{message}</p>
        )}

        <Button className="w-full" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>

        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-lg text-destructive">
              Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <DialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  Delete Account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete your account?</DialogTitle>
                  <DialogDescription>
                    This will permanently delete your account and all your data.
                    This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={isDeleting}
                  >
                    {isDeleting ? "Deleting..." : "Delete Account"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <Button
          variant="ghost"
          className="w-full"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          Sign Out
        </Button>
      </div>
    </div>
  );
}
