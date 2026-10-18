import { describe, expect, it } from "vitest";

import { getDashboardPreloadSnapshot } from "./dashboard-preload.js";

describe("dashboard preload module", () => {
  it("initializes a dashboard session when imported", () => {
    const snapshot = getDashboardPreloadSnapshot();

    expect(snapshot.sessionId).toMatch(/^dashboard-preload-\d+$/);
    expect(snapshot.targets.limits.resourceStatus).toBe("idle");
  });
});
