export const DASHBOARD_PRELOAD_TARGETS = Object.freeze(["limits"]);

export const DASHBOARD_PRELOAD_STATUSES = Object.freeze([
  "idle",
  "pending",
  "fulfilled",
  "rejected",
  "skipped",
]);

const DEFAULT_RESOURCE_LOADERS = Object.freeze({
  limits: () => import("../pages/LimitsPage.jsx"),
});

let sessionCounter = 0;

class WindowSessionCache {
  constructor() {
    this.limits = null;
  }

  read(targetKey, contextKey) {
    assertTargetKey(targetKey);
    if (targetKey !== "limits" || !this.limits || this.limits.contextKey !== contextKey) return null;
    return { ...this.limits };
  }

  write(entry) {
    if (entry.targetKey === "limits") this.limits = entry;
  }

  snapshot() {
    return { limits: this.limits ? { ...this.limits } : null };
  }
}
class DashboardWindowSession {
  constructor() {
    sessionCounter += 1;
    this.sessionId = `dashboard-preload-${sessionCounter}`;
    this.createdAt = Date.now();
    this.completedAt = null;
    this.startedAfterMainContentVisible = false;
    this.cache = new WindowSessionCache();
    this.targets = { limits: createTarget("limits") };
  }
}

function createTarget(key) {
  return {
    key,
    route: "/limits",
    resourceStatus: "idle",
    stateStatus: "idle",
    error: null,
    resourcePromise: null,
    resourceModule: null,
    resourceRequestId: 0,
  };
}

function createSession() {
  return new DashboardWindowSession();
}

let session = createSession();

function assertTargetKey(targetKey) {
  if (!DASHBOARD_PRELOAD_TARGETS.includes(targetKey)) {
    throw new Error(`Unknown dashboard preload target: ${targetKey}`);
  }
}

function normalizeError(error) {
  if (!error) return null;
  if (typeof error === "string") return error;
  return error.message || String(error);
}

function normalizeGeneratedAt(value) {
  const generatedAt = Number(value);
  return Number.isFinite(generatedAt) ? generatedAt : Date.now();
}

function cloneCacheEntry(entry) {
  return entry ? { ...entry } : null;
}

function targetSnapshot(target) {
  return {
    key: target.key,
    route: target.route,
    resourceStatus: target.resourceStatus,
    stateStatus: target.stateStatus,
    error: target.error,
  };
}

function updateCompletedAt() {
  const target = session.targets.limits;
  session.completedAt =
    target.resourceStatus === "fulfilled" || target.resourceStatus === "rejected"
      ? Date.now()
      : null;
}

export function resetDashboardPreload() {
  session = createSession();
}

export function markDashboardMainContentVisible() {
  session.startedAfterMainContentVisible = true;
}

export function getDashboardPreloadSnapshot() {
  return {
    sessionId: session.sessionId,
    createdAt: session.createdAt,
    completedAt: session.completedAt,
    startedAfterMainContentVisible: session.startedAfterMainContentVisible,
    cache: session.cache.snapshot(),
    targets: { limits: targetSnapshot(session.targets.limits) },
  };
}

export function buildDashboardPreloadContextKey(targetKey, context = {}) {
  assertTargetKey(targetKey);
  const entries = Object.entries(context)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value === null ? "null" : String(value)}`);
  return `${targetKey}:${entries.join("|")}`;
}

export function preloadDashboardPageResource(targetKey, options = {}) {
  assertTargetKey(targetKey);
  const target = session.targets[targetKey];
  if (target.resourceStatus === "fulfilled") return Promise.resolve(target.resourceModule);
  if (target.resourceStatus === "pending" && target.resourcePromise) return target.resourcePromise;

  const loader = options.loader || DEFAULT_RESOURCE_LOADERS[targetKey];
  const requestId = target.resourceRequestId + 1;
  target.resourceRequestId = requestId;
  target.resourceStatus = "pending";
  target.error = null;
  const promise = Promise.resolve()
    .then(() => loader())
    .then((module) => {
      if (target.resourceRequestId !== requestId || target.resourcePromise !== promise) return null;
      target.resourceStatus = "fulfilled";
      target.resourceModule = module;
      target.error = null;
      updateCompletedAt();
      return module;
    })
    .catch((error) => {
      if (target.resourceRequestId !== requestId || target.resourcePromise !== promise) return null;
      target.resourceStatus = "rejected";
      target.error = normalizeError(error);
      updateCompletedAt();
      return null;
    });
  target.resourcePromise = promise;
  return promise;
}

export function preloadDashboardPageResources(options = {}) {
  return Promise.all([
    preloadDashboardPageResource("limits", { loader: options.loaders?.limits }),
  ]);
}

export function publishReusablePageState(targetKey, state) {
  assertTargetKey(targetKey);
  const target = session.targets[targetKey];
  const status = state?.status || "fulfilled";
  const cacheEntry = {
    targetKey,
    status,
    data: state?.data ?? null,
    error: normalizeError(state?.error),
    source: state?.source || "silent-preload",
    generatedAt: normalizeGeneratedAt(state?.generatedAt),
    updatedAt: Date.now(),
    contextKey: state?.contextKey || buildDashboardPreloadContextKey(targetKey, state?.context || {}),
  };
  target.stateStatus = status;
  target.error = status === "fulfilled" ? null : cacheEntry.error;
  if (status === "fulfilled") session.cache.write(cacheEntry);
  return cloneCacheEntry(cacheEntry);
}

export function publishUsageLimitsPreloadState(data, options = {}) {
  return publishReusablePageState("limits", {
    data,
    source: options.source || "dashboard-existing",
    contextKey: options.contextKey || getUsageLimitsPreloadContextKey(options.context || {}),
    generatedAt: options.generatedAt,
    status: options.status || "fulfilled",
    error: options.error,
  });
}

export function getUsageLimitsPreloadContextKey(context = {}) {
  return buildDashboardPreloadContextKey("limits", { state: "current", ...context });
}

export function readReusablePageState(targetKey, contextKey) {
  assertTargetKey(targetKey);
  return session.cache.read(targetKey, contextKey);
}

export function readUsageLimitsPreloadState(contextKey = getUsageLimitsPreloadContextKey()) {
  return readReusablePageState("limits", contextKey);
}
