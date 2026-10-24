import React, { lazy, Suspense, useCallback, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import { useLocale } from "./hooks/useLocale.js";
import { ThemeProvider } from "./ui/foundation/ThemeProvider.jsx";
import { getBackendBaseUrl } from "./lib/config";
import { isMockEnabled } from "./lib/mock-mode";
import { isScreenshotModeEnabled } from "./lib/screenshot-mode";
import { AppLayout } from "./ui/components/Sidebar.jsx";
import { ToastProvider } from "./ui/components/Toast.jsx";
import {
  markDashboardMainContentVisible,
  preloadDashboardPageResources,
} from "./lib/dashboard-preload.js";
// The command palette is not first-paint critical; lazy loading keeps it out
// of the eager entry chunk. The lazy import has a null fallback: a client
// holding a stale index.html after a rebuild gets 404s on new chunks — a
// rejected lazy() would otherwise throw past the outer ErrorBoundary and
// blank the whole app.
const nullComponent = () => null;
const CommandPalette = lazy(() =>
  import("./ui/dashboard/components/CommandPalette.jsx")
    .then((m) => ({ default: m.CommandPalette }))
    .catch(() => ({ default: nullComponent })),
);
// Pages are lazy-loaded so each route ships in its own chunk; keeps the
// initial main bundle small. Routes are mutually exclusive, so only one
// chunk loads per navigation.
const DashboardPage = lazy(() =>
  import("./pages/DashboardPage.jsx").then((m) => ({ default: m.DashboardPage })),
);
const IpCheckPage = lazy(() => import("./pages/IpCheckPage.jsx"));
const ServiceStatusPage = lazy(() => import("./pages/ServiceStatusPage.jsx"));
const LimitsPage = lazy(() =>
  import("./pages/LimitsPage.jsx").then((m) => ({ default: m.LimitsPage })),
);
const WrappedPage = lazy(() => import("./pages/WrappedPage.jsx"));
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage.jsx").then((m) => ({ default: m.SettingsPage })),
);
const SkillsPage = lazy(() =>
  import("./pages/SkillsPage.jsx").then((m) => ({ default: m.SkillsPage })),
);
const SessionsPage = lazy(() =>
  import("./pages/SessionsPage.jsx").then((m) => ({ default: m.SessionsPage })),
);
const WidgetsPage = lazy(() =>
  import("./pages/WidgetsPage.jsx").then((m) => ({ default: m.WidgetsPage })),
);
const PetPage = lazy(() =>
  import("./pages/PetPage.jsx").then((m) => ({ default: m.PetPage })),
);
const DataTransferPage = lazy(() =>
  import("./pages/DataTransferPage.jsx").then((m) => ({ default: m.DataTransferPage })),
);

export default function App() {
  // Subscribing to locale here makes App rerender on language switch, which
  // rebuilds every child element reference and triggers copy() re-evaluation
  // across the tree — without unmounting lazy-loaded pages.
  const { resolvedLocale } = useLocale();
  const location = useLocation();
  const dashboardMainContentVisibleRef = useRef(false);
  const dashboardResourcePreloadStartedRef = useRef(false);
  const mockEnabled = isMockEnabled();
  const screenshotMode = useMemo(() => {
    if (typeof window === "undefined") return false;
    return isScreenshotModeEnabled(window.location.search);
  }, []);
  const pathname = location?.pathname || "/";

  const isLocalMode =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  const isDashboardDefaultPath = normalizedPath === "/" || normalizedPath === "/dashboard";

  const signedIn = isLocalMode || mockEnabled || screenshotMode;
  const sessionSoftExpired = false;
  const baseUrl = getBackendBaseUrl();

  const handleDashboardMainContentVisible = useCallback(() => {
    if (!isDashboardDefaultPath) return;
    if (!dashboardMainContentVisibleRef.current) {
      dashboardMainContentVisibleRef.current = true;
      markDashboardMainContentVisible();
    }
    if (!dashboardResourcePreloadStartedRef.current) {
      dashboardResourcePreloadStartedRef.current = true;
      void preloadDashboardPageResources();
    }
  }, [isDashboardDefaultPath]);

  const isLimitsPath = normalizedPath === "/limits";
  const isSettingsPath = normalizedPath === "/settings";
  const isSkillsPath = normalizedPath === "/skills";
  const isSessionsPath = normalizedPath === "/sessions";
  const isWidgetsPath = normalizedPath === "/widgets";
  const isPetPath = normalizedPath === "/pet-settings";
  const isIpCheckPath = normalizedPath === "/ip-check";
  const isServiceStatusPath = normalizedPath === "/service-status";
  const isDataTransferPath = normalizedPath === "/data-transfer" && isLocalMode;

  let PageComponent = DashboardPage;
  if (isLimitsPath) {
    PageComponent = LimitsPage;
  } else if (isSettingsPath) {
    PageComponent = SettingsPage;
  } else if (isSkillsPath) {
    PageComponent = SkillsPage;
  } else if (isSessionsPath) {
    PageComponent = SessionsPage;
  } else if (isWidgetsPath) {
    PageComponent = WidgetsPage;
  } else if (isPetPath) {
    PageComponent = PetPage;
  } else if (isIpCheckPath) {
    PageComponent = IpCheckPage;
  } else if (isServiceStatusPath) {
    PageComponent = ServiceStatusPage;
  } else if (isDataTransferPath) {
    PageComponent = DataTransferPage;
  }

  const showSidebar =
    normalizedPath === "/dashboard" ||
    normalizedPath === "/" ||
    isLimitsPath ||
    isSettingsPath ||
    isSkillsPath ||
    isSessionsPath ||
    isWidgetsPath ||
    isPetPath ||
    isIpCheckPath ||
    isServiceStatusPath ||
    isDataTransferPath;

  let content = null;
  if (normalizedPath === "/wrapped") {
    // Year-end Wrapped page. Reads from /functions/tokentracker-wrapped
    // (provided by the local CLI server).
    content = <WrappedPage />;
  } else {
    const pageNode = (<>
      <PageComponent
        key={resolvedLocale}
        baseUrl={baseUrl}
        signedIn={signedIn}
        sessionSoftExpired={sessionSoftExpired}
        onMainContentVisible={handleDashboardMainContentVisible}
      />
    </>);
    if (showSidebar) {
      content = <AppLayout>{pageNode}</AppLayout>;
    } else {
      content = pageNode;
    }
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
            <Suspense fallback={null}>{content}</Suspense>
            <Suspense fallback={null}>
              {showSidebar ? <CommandPalette /> : null}
            </Suspense>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
