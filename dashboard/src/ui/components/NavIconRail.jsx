import React from "react";
import { Link } from "react-router-dom";
import { copy } from "../../lib/copy";
import { cn } from "../../lib/cn";

function isActive(pathname, to) {
  if (!pathname) return false;
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (to === "/dashboard") {
    return normalized === "/dashboard" || normalized === "/";
  }
  return normalized === to;
}

/**
 * Fixed icon-only navigation used by the rainy neon store theme.
 * On hover/focus each glass chip expands into a horizontal pill that shows
 * the destination name beside the icon.
 */
export function NavIconRail({ groups, pathname, onNavigate, className = "" }) {
  return (
    <nav
      aria-label={copy("nav.nav_label")}
      className={cn("flex flex-col items-start gap-2.5", className)}
      data-rainy-nav-rail
    >
      {groups.map((group) =>
        group.items.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.to);
          return (
            <RailLink
              key={item.id}
              item={item}
              Icon={Icon}
              active={active}
              onNavigate={onNavigate}
            />
          );
        }),
      )}
    </nav>
  );
}

function RailLink({ item, Icon, active, onNavigate }) {
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "tt-rainy-rail-chip group/rail relative flex h-11 items-center overflow-hidden rounded-2xl no-underline outline-none",
        active
          ? "tt-rainy-rail-active text-cyan-100"
          : "text-slate-300 hover:text-white",
      )}
    >
      <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.8} aria-hidden="true" />
      <span className="tt-rainy-rail-label" aria-hidden="true">
        {item.label}
      </span>
    </Link>
  );
}
