"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
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
import { Bell, BellOff, Calendar, CalendarCheck, CalendarX, CreditCard } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";

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
  const [showReuploadDialog, setShowReuploadDialog] = useState(false);
  const [message, setMessage] = useState("");

  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError] = useState("");
  const [isSendingTestPush, setIsSendingTestPush] = useState(false);

  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [includeMedications, setIncludeMedications] = useState(false);
  const [calendarSyncedAt, setCalendarSyncedAt] = useState<string | null>(null);
  const [calendarSyncedMeds, setCalendarSyncedMeds] = useState(false);

  const [billingStatus, setBillingStatus] = useState<{
    status: string;
    periodEnd: string | null;
    cardLast4: string | null;
    freeAccess: boolean;
    isActive: boolean;
  } | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
      return;
    }

    if (status === "authenticated") {
      fetchSettings();
      checkPushSupport();
      checkCalendarStatus();
      fetchBillingStatus();
    }
  }, [status, router]);

  const fetchBillingStatus = async () => {
    try {
      const res = await fetch("/api/stripe/status");
      const data = await res.json();
      if (res.ok && data.data) {
        setBillingStatus(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch billing status:", err);
    }
  };

  const handleManageBilling = async () => {
    setBillingLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.data?.url) {
        window.location.href = data.data.url;
      } else {
        setMessage(data.error || "Failed to open billing portal");
      }
    } catch {
      setMessage("Failed to open billing portal");
    } finally {
      setBillingLoading(false);
    }
  };

  const handleSubscribe = async () => {
    setBillingLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnTo: "/today?checkout=success" }),
      });
      const data = await res.json();
      if (res.ok && data.data?.url) {
        window.location.href = data.data.url;
      } else {
        setMessage(data.error || "Failed to start checkout");
      }
    } catch {
      setMessage("Failed to start checkout");
    } finally {
      setBillingLoading(false);
    }
  };

  const checkPushSupport = async () => {
    if (typeof window === "undefined") return;
    
    const supported = "serviceWorker" in navigator && "PushManager" in window;
    setPushSupported(supported);
    
    if (supported) {
      try {
        const res = await fetch("/api/push/status");
        const data = await res.json();
        if (res.ok && data.data) {
          setPushEnabled(data.data.enabled);
        }
      } catch (err) {
        console.error("Failed to check push status:", err);
      }
    }
  };

  const checkCalendarStatus = async () => {
    try {
      const res = await fetch("/api/calendar/status");
      const data = await res.json();
      if (res.ok && data.data) {
        setCalendarConnected(data.data.connected);
        setCalendarSyncedAt(data.data.syncedAt);
        setCalendarSyncedMeds(data.data.syncedMeds || false);
      }
    } catch (err) {
      console.error("Failed to check calendar status:", err);
    }
  };

  const handleConnectCalendar = () => {
    setCalendarLoading(true);
    window.location.href = "/api/calendar/auth?returnTo=/settings";
  };

  const handleDisconnectCalendar = async () => {
    setCalendarLoading(true);
    try {
      const res = await fetch("/api/calendar/disconnect", { method: "POST" });
      if (res.ok) {
        setCalendarConnected(false);
        setMessage("Calendar disconnected");
      } else {
        setMessage("Failed to disconnect calendar");
      }
    } catch {
      setMessage("Failed to disconnect calendar");
    } finally {
      setCalendarLoading(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleSyncCalendar = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/calendar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeMedications }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.data?.message || "Calendar synced!");
        setCalendarSyncedAt(new Date().toISOString());
        setCalendarSyncedMeds(includeMedications);
      } else {
        setMessage(data.error || "Failed to sync calendar");
      }
    } catch {
      setMessage("Failed to sync calendar");
    } finally {
      setIsSyncing(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };

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

  const togglePushNotifications = async () => {
    if (!pushSupported) return;
    
    setPushLoading(true);
    setPushError("");

    try {
      if (pushEnabled) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        
        if (subscription) {
          await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          });
          await subscription.unsubscribe();
        }
        
        setPushEnabled(false);
        setMessage("Push notifications disabled");
      } else {
        const permission = await Notification.requestPermission();
        
        if (permission !== "granted") {
          setPushError("Permission denied. Please enable notifications in your browser settings.");
          return;
        }

        const registration = await navigator.serviceWorker.ready;
        
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""
          ),
        });

        const res = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription.toJSON()),
        });

        if (!res.ok) {
          throw new Error("Failed to save subscription");
        }

        setPushEnabled(true);
        setMessage("Push notifications enabled");
      }
    } catch (err) {
      console.error("Push toggle error:", err);
      setPushError(err instanceof Error ? err.message : "Failed to toggle notifications");
    } finally {
      setPushLoading(false);
      setTimeout(() => setMessage(""), 3000);
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

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center pb-20">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!settings) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-semibold">Settings</h1>

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
            <CardTitle className="text-lg">Subscription</CardTitle>
            <CardDescription>
              Manage your IVF Buddy subscription
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <CreditCard className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">
                    {billingStatus?.freeAccess
                      ? "Free Access"
                      : billingStatus?.isActive
                      ? "Active"
                      : "Not Subscribed"}
                  </p>
                  {billingStatus?.cardLast4 && (
                    <p className="text-xs text-muted-foreground">
                      Card ending in {billingStatus.cardLast4}
                    </p>
                  )}
                  {billingStatus?.periodEnd && billingStatus.isActive && !billingStatus.freeAccess && (
                    <p className="text-xs text-muted-foreground">
                      Next billing: {new Date(billingStatus.periodEnd).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {billingStatus?.isActive && !billingStatus?.freeAccess ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleManageBilling}
                disabled={billingLoading}
              >
                {billingLoading ? "Loading..." : "Manage Billing"}
              </Button>
            ) : !billingStatus?.freeAccess ? (
              <Button
                className="w-full"
                onClick={handleSubscribe}
                disabled={billingLoading}
              >
                {billingLoading ? "Loading..." : "Subscribe - $12/month"}
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Push Notifications</CardTitle>
            <CardDescription>
              Receive reminders directly on your device
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pushSupported ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {pushEnabled ? (
                      <Bell className="h-5 w-5 text-primary" />
                    ) : (
                      <BellOff className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium">
                        {pushEnabled ? "Notifications On" : "Notifications Off"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {pushEnabled
                          ? "You'll receive push notifications"
                          : "Enable to receive reminders"}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={pushEnabled}
                    onCheckedChange={togglePushNotifications}
                    disabled={pushLoading}
                  />
                </div>
                {pushError && (
                  <p className="text-sm text-destructive">{pushError}</p>
                )}

                {pushEnabled && (
                  <div className="pt-4 border-t">
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={isSendingTestPush}
                      onClick={async () => {
                        setIsSendingTestPush(true);
                        setMessage("");
                        try {
                          const res = await fetch("/api/test/push", { method: "POST" });
                          const data = await res.json();
                          if (res.ok) {
                            setMessage("Test push sent! Check your notifications.");
                          } else {
                            setMessage(data.error || "Failed to send test push");
                          }
                        } catch {
                          setMessage("Failed to send test push");
                        } finally {
                          setIsSendingTestPush(false);
                        }
                      }}
                    >
                      {isSendingTestPush ? "Sending..." : "Send Test Push"}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Send a test notification to verify push is working
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Push notifications are not supported on this device/browser.
                Try adding this app to your home screen first.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Google Calendar</CardTitle>
            <CardDescription>
              Sync appointments to your calendar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {calendarConnected ? (
                  <CalendarCheck className="h-5 w-5 text-primary" />
                ) : (
                  <CalendarX className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium">
                    {calendarConnected ? "Connected" : "Not connected"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {calendarConnected
                      ? "Your appointments sync to Google Calendar"
                      : "Connect to add appointments to your calendar"}
                  </p>
                </div>
              </div>
            </div>

            {calendarConnected ? (
              <div className="space-y-4">
                {calendarSyncedAt && (
                  <div className="p-3 bg-muted/50 rounded-lg text-sm">
                    <p className="font-medium text-primary">✓ Already synced</p>
                    <p className="text-muted-foreground">
                      Last synced: {new Date(calendarSyncedAt).toLocaleDateString("en-US", { 
                        month: "short", day: "numeric", hour: "numeric", minute: "2-digit" 
                      })}
                      {calendarSyncedMeds ? " (with medications)" : " (appointments only)"}
                    </p>
                    {!calendarSyncedMeds && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Check the box below to add medication reminders
                      </p>
                    )}
                  </div>
                )}
                
                {!calendarSyncedMeds && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="includeMeds"
                      checked={includeMedications}
                      onCheckedChange={(checked) => setIncludeMedications(!!checked)}
                    />
                    <Label htmlFor="includeMeds" className="text-sm cursor-pointer">
                      Include medication reminders
                    </Label>
                  </div>
                )}

                {calendarSyncedAt && (
                  <p className="text-xs text-amber-600">
                    ⚠️ Syncing again will create duplicate events in your calendar
                  </p>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleSyncCalendar}
                    disabled={isSyncing || !!(calendarSyncedAt && calendarSyncedMeds && !includeMedications)}
                  >
                    {isSyncing ? "Syncing..." : calendarSyncedAt ? "Sync Again" : "Sync Now"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleDisconnectCalendar}
                    disabled={calendarLoading}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                onClick={handleConnectCalendar}
                disabled={calendarLoading}
                className="w-full"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Connect Google Calendar
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Preferences</CardTitle>
            <CardDescription>
              Configure your notification preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                No notifications will be sent during these hours
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

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Protocol</CardTitle>
            <CardDescription>
              Update your medication protocol
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog open={showReuploadDialog} onOpenChange={setShowReuploadDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  Re-upload Protocol
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Replace your protocol?</DialogTitle>
                  <DialogDescription>
                    This will delete your current protocol including all medications, 
                    appointments, tasks, and check-ins. Your chat history will be preserved.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowReuploadDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      setShowReuploadDialog(false);
                      router.push("/onboarding?reupload=true");
                    }}
                  >
                    Continue
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Upload a new protocol document to update your medications
            </p>
          </CardContent>
        </Card>

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

      <BottomNav />
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}
