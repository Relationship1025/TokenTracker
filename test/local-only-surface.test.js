const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

test("local-only dashboard removes cloud, leaderboard, profile, and achievements surfaces", () => {
  const app = read("dashboard", "src", "App.jsx");
  const settings = read("dashboard", "src", "pages", "SettingsPage.jsx");
  const skills = read("dashboard", "src", "pages", "SkillsPage.jsx");
  const skillsApi = read("dashboard", "src", "lib", "skills-api.ts");

  for (const marker of [
    "CloudPage",
    "CloudCheckoutPage",
    "LeaderboardPage",
    "LeaderboardProfilePage",
    "AchievementsPage",
    "useCloudUsageSync",
    "/leaderboard",
    "/cloud",
    "/billing/checkout",
    "/achievements",
  ]) {
    assert.equal(app.includes(marker), false, marker);
  }
  assert.equal(/SETTINGS_SECTION_IDS\.CLOUD|<CloudSection\b/.test(settings), false);
  for (const marker of [
    "getAccountSkillInventories",
    "publishSkillInventory",
    "mergeSkillInventories",
    "getCloudSyncEnabled",
    "CLOUD_SLUG",
  ]) {
    assert.equal((skills + "\n" + skillsApi).includes(marker), false, marker);
  }
});
