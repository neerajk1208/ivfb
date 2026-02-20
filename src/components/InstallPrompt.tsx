"use client";

import { useState, useEffect } from "react";
import { X, Share, Plus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop" | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) return;

    const dismissed = localStorage.getItem("install-prompt-dismissed");
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) return;
    }

    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setPlatform("ios");
      setShow(true);
    } else if (/android/.test(ua)) {
      setPlatform("android");
    } else {
      setPlatform("desktop");
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem("install-prompt-dismissed", Date.now().toString());
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShow(false);
      }
      setDeferredPrompt(null);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom duration-300">
      <div className="max-w-md mx-auto bg-card border rounded-2xl shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Download className="w-5 h-5 text-primary" />
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">Install IVF Buddy</p>
            
            {platform === "ios" && (
              <p className="text-xs text-muted-foreground mt-1">
                Tap <Share className="w-3 h-3 inline mx-0.5" /> then <span className="whitespace-nowrap">"Add to Home Screen" <Plus className="w-3 h-3 inline" /></span>
              </p>
            )}
            
            {platform === "android" && deferredPrompt && (
              <Button 
                size="sm" 
                className="mt-2 h-8 text-xs"
                onClick={handleInstall}
              >
                Add to Home Screen
              </Button>
            )}
            
            {platform === "android" && !deferredPrompt && (
              <p className="text-xs text-muted-foreground mt-1">
                Tap menu (⋮) then "Add to Home Screen"
              </p>
            )}
            
            {platform === "desktop" && deferredPrompt && (
              <Button 
                size="sm" 
                className="mt-2 h-8 text-xs"
                onClick={handleInstall}
              >
                Install App
              </Button>
            )}
            
            {platform === "desktop" && !deferredPrompt && (
              <p className="text-xs text-muted-foreground mt-1">
                Install from your browser menu for quick access
              </p>
            )}
          </div>

          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-muted rounded-full transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
