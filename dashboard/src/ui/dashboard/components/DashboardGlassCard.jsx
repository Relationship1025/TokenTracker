import React from "react";
import { cn } from "../../../lib/cn";

/**
 * Adds the rainy-store outer glass treatment to each top-level dashboard card
 * without replacing the card's own component or behavior. Theme state is
 * supplied by the caller so this wrapper remains usable in isolated card tests.
 *
 * Cards that intentionally render null (QualityPerDollar, SessionInsights, …)
 * must not leave an empty glass shell: that shell is a non-empty child of
 * SortableCard's data-sortable-body, so has-[[:empty]:hidden] never fires and
 * the border/inset shadows show up as stray horizontal lines under Trend.
 */
export function DashboardGlassCard({ active, children, className = "" }) {
  if (React.Children.toArray(children).length === 0) return null;
  if (!active) return children;
  return (
    <div data-rainy-card="true" className={cn("tt-rainy-card", className)}>
      {children}
    </div>
  );
}
