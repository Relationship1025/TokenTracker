const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const repoRoot = path.join(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("Windows hides and reuses the dashboard WebView2 on normal close", () => {
  const windowSource = read("TokenTrackerWin/DashboardWindow.cs");

  assert.match(windowSource, /private void HideToTray\(\)/);
  assert.match(windowSource, /private WebView2CompositionControl _webView = CreateWebViewControl\(\)/);
  assert.match(windowSource, /_webView\.Dispose\(\)/);

  const closingHandler = windowSource.match(
    /protected override void OnClosing\([\s\S]*?\r?\n    }\r?\n\r?\n    protected override void OnClosed/,
  )?.[0];
  assert.ok(closingHandler, "Dashboard closing handler should exist");
  assert.match(closingHandler, /if \(!_exiting\)/);
  assert.match(closingHandler, /e\.Cancel = true;\s*Hide\(\);/);
  assert.match(closingHandler, /if \(!_exiting\)/, "normal closes hide to reuse the WebView");
});

test("Windows publishes WebView initialization before running it", () => {
  const source = read("TokenTrackerWin/DashboardWindow.cs");
  const initStart = source.indexOf("private Task InitializeWebViewAsync()");
  const retryStart = source.indexOf("    private async Task InitializeWebViewWithRetryAsync", initStart);
  const initSource = source.slice(initStart, retryStart);

  assert.match(
    initSource,
    /var completion = new TaskCompletionSource<bool>[\s\S]*?var task = completion\.Task[\s\S]*?_initializationTask = task[\s\S]*?_ = RunWebViewInitializationAsync\(task, completion\)/,
    "the in-flight task must be published before initialization starts",
  );
  assert.match(
    source,
    /private async Task RunWebViewInitializationAsync\([\s\S]*?ReferenceEquals\(_initializationTask, identity\)[\s\S]*?_initializationTask = null;/,
    "completion cleanup must not clear a newer initialization task",
  );
  assert.doesNotMatch(
    source.slice(retryStart, source.indexOf("    private async Task InitializeWebViewCoreAsync", retryStart)),
    /finally\s*\{\s*_initializationTask = null;/,
    "the retry routine must not unconditionally clear the shared task",
  );
});
