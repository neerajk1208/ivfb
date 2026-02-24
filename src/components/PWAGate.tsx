"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Share, Plus, MoreVertical, Smartphone } from "lucide-react";

type Platform = "ios" | "android" | "desktop" | null;

function detectPlatform(): Platform {
  if (typeof window === "undefined") return null;
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

function isRunningAsPWA(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

export function PWAGate({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [showGate, setShowGate] = useState(false);
  const [platform, setPlatform] = useState<Platform>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isPWA = isRunningAsPWA();
    const skipped = sessionStorage.getItem("pwa-gate-skipped") === "true";

    setPlatform(detectPlatform());
    setChecking(false);

    if (status === "authenticated" && !isPWA && !skipped) {
      setShowGate(true);
    } else {
      setShowGate(false);
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, [status]);

  const handleSkip = () => {
    sessionStorage.setItem("pwa-gate-skipped", "true");
    setShowGate(false);
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowGate(false);
      }
      setDeferredPrompt(null);
    }
  };

  if (checking || status === "loading") {
    return null;
  }

  if (!showGate) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-6">
      <Card className="max-w-md w-full shadow-xl border-0 bg-card/95 backdrop-blur">
        <CardContent className="pt-8 pb-6 px-6">
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Smartphone className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold mb-3">
              Get the Full Experience
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              Install IVF Buddy on your home screen for instant access, 
              medication reminders, and a seamless experience throughout your journey.
            </p>
          </div>

          <div className="space-y-4">
            {platform === "ios" && (
              <div className="bg-muted/50 rounded-xl p-4">
                <p className="font-medium text-sm mb-3">How to install on iPhone:</p>
                <ol className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-medium">1</span>
                    <span>
                      Tap the <Share className="w-4 h-4 inline mx-1 -mt-0.5" /> Share button at the bottom of Safari
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-medium">2</span>
                    <span>
                      Scroll down and tap <Plus className="w-4 h-4 inline mx-1 -mt-0.5" /> <strong>Add to Home Screen</strong>
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-medium">3</span>
                    <span>Tap <strong>Add</strong> in the top right corner</span>
                  </li>
                </ol>
              </div>
            )}

            {platform === "android" && (
              <div className="bg-muted/50 rounded-xl p-4">
                {deferredPrompt ? (
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-4">
                      Tap the button below to add IVF Buddy to your home screen.
                    </p>
                    <Button onClick={handleInstall} className="w-full">
                      Add to Home Screen
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="font-medium text-sm mb-3">How to install on Android:</p>
                    <ol className="space-y-3 text-sm text-muted-foreground">
                      <li className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-medium">1</span>
                        <span>
                          Tap the <MoreVertical className="w-4 h-4 inline mx-1 -mt-0.5" /> menu in Chrome
                        </span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-medium">2</span>
                        <span>
                          Tap <strong>Add to Home screen</strong> or <strong>Install app</strong>
                        </span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-medium">3</span>
                        <span>Tap <strong>Add</strong> to confirm</span>
                      </li>
                    </ol>
                  </>
                )}
              </div>
            )}

            {platform === "desktop" && (
              <div className="bg-muted/50 rounded-xl p-4">
                {deferredPrompt ? (
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-4">
                      Click below to install IVF Buddy as a desktop app.
                    </p>
                    <Button onClick={handleInstall} className="w-full">
                      Install App
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="font-medium text-sm mb-3">Install as a desktop app:</p>
                    <p className="text-sm text-muted-foreground">
                      Look for the install icon in your browser&apos;s address bar, or use the browser menu to install this app.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t">
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={handleSkip}
            >
              Skip for now
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
