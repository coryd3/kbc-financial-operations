import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { api } from "./api";

/** Records a page view in the app database each time the route changes. */
export function usePageTracking() {
  const [location] = useLocation();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    if (lastTracked.current === location) return;
    lastTracked.current = location;
    api.track(location).catch(() => {
      // Tracking failures should never break the app.
    });
    // Also notify GoatCounter of SPA navigation if the script loaded.
    const gc = (window as any).goatcounter;
    if (gc && typeof gc.count === "function") {
      gc.count({ path: location });
    }
  }, [location]);
}
