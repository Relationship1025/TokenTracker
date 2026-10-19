import React from "react";
import { cn } from "../../../lib/cn";

/**
 * Adds the rainy-store outer glass treatment to each top-level dashboard card
 * without replacing the card's own component or behavior. Theme state is
 * supplied by the caller so this wrapper remains usable in isolated card tests.
 */
export function DashboardGlassCard({ active, children, className = "" }) {
  if (!active) return children;
  return (
    <div data-rainy-card="true" className={cn("tt-rainy-card", className)}>
      {children}
    </div>
  );
}
