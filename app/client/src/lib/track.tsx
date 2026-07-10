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
    const isPublic = location === "/" || location === "/docs" || location.startsWith("/docs/") || location === "/login" || location === "/register" || location === "/reset-password";
    if (!isPublic) return;
    const normalized = location.replace(/\/\d+(?=\/|$)/g, "/:id");
    const count = () => {
      const gc = (window as any).goatcounter;
      if (gc && typeof gc.count === "function") gc.count({ path: normalized });
    };
    const existing = document.querySelector<HTMLScriptElement>("script[data-goatcounter]");
    if (existing) {
      count();
      return;
    }
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://gc.zgo.at/count.js";
    script.dataset.goatcounter = "https://kbc-financial-operations.goatcounter.com/count";
    script.dataset.goatcounterSettings = JSON.stringify({ no_onload: true });
    script.addEventListener("load", count, { once: true });
    document.head.appendChild(script);
  }, [location]);
}
