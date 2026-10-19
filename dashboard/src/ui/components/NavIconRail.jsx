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
 * Fixed icon-only navigation used by the rainy neon store theme. Labels remain
 * available to assistive technology and appear as visual tooltips on hover or
 * keyboard focus.
 */
export function NavIconRail({ groups, pathname, onNavigate, className = "" }) {
  return (
    <nav
      aria-label={copy("nav.nav_label")}
      className={cn("flex flex-col items-center gap-2", className)}
      data-rainy-nav-rail
    >
      {groups.map((group, groupIndex) => (
        <React.Fragment key={group.id}>
          {groupIndex > 0 ? (
            <div className="my-1 h-px w-7 bg-white/10" aria-hidden="true" />
          ) : null}
          <div className="flex flex-col items-center gap-1.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.to);
              return (
                <Link
                  key={item.id}
                  to={item.to}
                  onClick={onNavigate}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  title={item.label}
                  className={cn(
                    "group/rail relative flex h-10 w-10 items-center justify-center rounded-lg no-underline outline-none transition-colors",
                    active
                      ? "bg-cyan-300/15 text-cyan-100 shadow-[inset_0_0_0_1px_rgba(103,232,212,0.24)]"
                      : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100",
                  )}
                >
                  <Icon className="h-[17px] w-[17px]" strokeWidth={1.8} aria-hidden="true" />
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-md border border-white/10 bg-slate-950/95 px-2.5 py-1.5 text-[11px] font-medium text-slate-100 opacity-0 shadow-xl transition-opacity duration-150 group-hover/rail:opacity-100 group-focus-visible/rail:opacity-100"
                  >
                    {item.label}
                  </span>
                  {active ? (
                    <span
                      className="absolute -left-[9px] h-4 w-0.5 rounded-full bg-cyan-300"
                      aria-hidden="true"
                    />
                  ) : null}
                </Link>
              );
            })}
          </div>
        </React.Fragment>
      ))}
    </nav>
  );
}
