using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Windows;
using System.Windows.Interop;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace TokenTrackerWin;

/// <summary>
/// Configuration of one desktop widget surface: which page it hosts, the message
/// prefix it speaks, its collapsed/expanded sizes, and how many selectable rows
/// it supports (0 = no selection messages).
/// </summary>
internal sealed record DesktopWidgetDescriptor(
    string Kind,
    string PagePath,
    string MessagePrefix,
    double CollapsedWidth,
    double CollapsedHeight,
    double ExpandedWidth,
    double ExpandedHeight,
    int MaxSelected = 0,
    int DefaultSlot = 0);

/// <summary>
/// A tray-owned always-on-top widget surface hosting a WebView2 page served by
/// the local server (quota, summary, heatmap, top models, limits…). Owns the
/// whole generic machinery: transparent chrome-less window, WebView2 lifecycle
/// with crash recovery, drag, DPI-aware placement with rounded-region clipping,
/// fullscreen-app auto-hide, and the <c>&lt;prefix&gt;:ready/expand/collapse/
/// close/dashboard/drag</c> message protocol. Subclasses supply persistence and
/// the context payload pushed into the page.
/// </summary>
internal abstract class DesktopWidgetWindowBase : Window
{
    private const int MaxRecoveryAttempts = 2;
    private const uint EventSystemForeground = 0x0003;
    private const uint EventObjectLocationChange = 0x800B;
    private const uint WineventOutOfContext = 0x0000;

    private readonly ServerManager _server;
    private readonly WidgetWebViewEnvironment _webViewEnvironment;
    private readonly Action _openDashboard;
    private readonly DesktopWidgetDescriptor _descriptor;
    private readonly WinEventDelegate _winEventCallback;
    private WebView2CompositionControl? _view;
    private bool _failed;
    private bool _ready;
    private bool _closed;
    private bool _expanded;
    private bool _placed;
    private bool _fullscreenHidden;
    private string _style;
    private bool _light;
    private bool _recoveryInFlight;
    private int _recoveryAttempts;
    private int _generation;
    private int _fullscreenCheckQueued;
    private Task? _initializationTask;
    private string _locale;
    private string? _lastContext;
    private nint _hwnd;
    private nint _foregroundHook;
    private nint _locationChangeHook;
    private (int Width, int Height, int Radius) _regionSize;
    private bool _enabled;
    private int? _savedX;
    private int? _savedY;

    public bool Enabled => _enabled;
    public event Action? EnabledChanged;
    public string Kind => _descriptor.Kind;

    protected DesktopWidgetWindowBase(
        DesktopWidgetDescriptor descriptor,
        ServerManager server,
        Action openDashboard,
        WidgetWebViewEnvironment webViewEnvironment)
    {
        _descriptor = descriptor;
        _server = server;
        _openDashboard = openDashboard;
        _webViewEnvironment = webViewEnvironment;
        _winEventCallback = OnWinEvent;

        _enabled = LoadEnabled();
        (_savedX, _savedY) = LoadPosition() ?? (null, null);
        _locale = NativeLocalization.CurrentResolvedLocale;
        _style = NativeTheme.ResolveWidgetStyle(NativeTheme.CurrentPreference, NativeTheme.CurrentNeonStorePeriod);
        _light = NativeTheme.IsLightWidgetStyle(_style);

        Title = Constants.AppDisplayName;
        Width = _descriptor.CollapsedWidth;
        Height = _descriptor.CollapsedHeight;
        WindowStyle = WindowStyle.None;
        ResizeMode = ResizeMode.NoResize;
        AllowsTransparency = true;
        Background = System.Windows.Media.Brushes.Transparent;
        Topmost = true;
        ShowInTaskbar = false;
        ShowActivated = false;
        SourceInitialized += (_, _) =>
        {
            _hwnd = new WindowInteropHelper(this).Handle;
            // Tool window: excluded from Alt+Tab. Explicit clicks can still focus controls.
            SetWindowLongPtr(_hwnd, -20, GetWindowLongPtr(_hwnd, -20) | 0x80);
            HwndSource.FromHwnd(_hwnd)?.AddHook(WindowMessage);
        };
        IsVisibleChanged += (_, _) => OnVisibilityChanged();
        _server.StatusChanged += ServerChanged;
        Closing += (_, e) =>
        {
            if (_closed) return;
            e.Cancel = true;
            SetEnabled(false);
        };
    }

    // ── Persistence + payload, supplied by subclasses ────────────────────

    /// <summary>Enabled flag as persisted for this widget kind.</summary>
    protected abstract bool LoadEnabled();

    protected abstract void PersistEnabled(bool enabled);

    /// <summary>Last saved window position (physical pixels), if any.</summary>
    protected abstract (int? X, int? Y)? LoadPosition();

    protected abstract void PersistPosition(int? x, int? y);

    /// <summary>Selected row ids for widgets with selection support.</summary>
    protected abstract string[] LoadSelected();

    protected abstract void PersistSelected(string[] ids);

    /// <summary>Fallback-button label when WebView2 cannot start.</summary>
    protected abstract string FallbackLabel(string locale);

    /// <summary>Add the widget-specific payload properties to the context push.</summary>
    protected abstract void AddContextProperties(JsonObject context);

    /// <summary>
    /// Subclasses call when fresh data arrives: clears the failed flag and
    /// re-pushes the context. (Base ctor runs before subclass fields init, so
    /// the Load* overrides must not touch subclass instance state.)
    /// </summary>
    protected void DataApplied() { _failed = false; PushContext(); }

    // ── Public lifecycle ─────────────────────────────────────────────────

    public void SetEnabled(bool enabled)
    {
        if (_closed) return;
        var wasEnabled = _enabled;
        _enabled = enabled;
        PersistEnabled(enabled);

        if (enabled)
        {
            if (!wasEnabled)
            {
                _recoveryAttempts = 0;
                _expanded = false;
                Width = _descriptor.CollapsedWidth;
                Height = _descriptor.CollapsedHeight;
            }
            EnsureView();
            if (!IsVisible) Show();
            StartFullscreenMonitoring();
            CheckFullscreenState();
            if (IsVisible)
            {
                Place(!_placed);
                _placed = true;
            }
            EnsureInitialized();
        }
        else
        {
            _fullscreenHidden = false;
            StopFullscreenMonitoring();
            Hide();
            ReleaseView();
        }

        EnabledChanged?.Invoke();
    }

    public void ApplyLocale(string locale)
    {
        if (_locale == locale) return;
        _locale = locale;
        if (_view is null && Content is System.Windows.Controls.Button button)
            button.Content = FallbackLabel(_locale);
        _lastContext = null;
        PushContext();
    }

    public void ApplyTheme(string style)
    {
        var normalized = string.IsNullOrWhiteSpace(style) ? "classic-dark" : style;
        if (_style == normalized) return;
        _style = normalized;
        _light = NativeTheme.IsLightWidgetStyle(normalized);
        _lastContext = null;
        PushContext();
    }

    public void MarkFailed()
    {
        _failed = true;
        PushContext();
    }

    public void Shutdown()
    {
        if (_closed) return;
        _closed = true;
        StopFullscreenMonitoring();
        _server.StatusChanged -= ServerChanged;
        ReleaseView();
        Close();
    }

    // ── WebView2 lifecycle ───────────────────────────────────────────────

    private WebView2CompositionControl EnsureView()
    {
        if (_view is not null) return _view;
        var view = new WebView2CompositionControl { AllowExternalDrop = false };
        _view = view;
        Content = view;
        _placed = false;
        return view;
    }

    private void EnsureInitialized()
    {
        if (!_enabled || _closed) return;
        var view = EnsureView();
        if (_initializationTask is { IsCompleted: false }) return;
        _initializationTask = InitializeAsync(view, _generation);
    }

    private async Task InitializeAsync(WebView2CompositionControl view, int generation)
    {
        try
        {
            if (view.CoreWebView2 is not null || !IsCurrent(view, generation)) return;
            var environment = await _webViewEnvironment.GetAsync();
            if (!IsCurrent(view, generation)) return;
            await view.EnsureCoreWebView2Async(environment);
            if (!IsCurrent(view, generation)) return;

            view.DefaultBackgroundColor = System.Drawing.Color.Transparent;
            var core = view.CoreWebView2 ?? throw new InvalidOperationException("WebView2 initialization did not create a core.");
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.AreDevToolsEnabled = false;
            core.NewWindowRequested += (_, e) => e.Handled = true;
            core.NavigationStarting += (sender, e) =>
            {
                if (!IsCurrent(view, generation)) return;
                if (!AllowedSource(e.Uri)) e.Cancel = true;
                _ready = false;
            };
            core.WebMessageReceived += ReceiveMessage;
            core.ProcessFailed += (_, e) => OnProcessFailed(core, view, generation, e.ProcessFailedKind);
            Navigate();
        }
        catch (Exception ex)
        {
            if (!IsCurrent(view, generation)) return;
            Diag.Log(_descriptor.Kind, $"initialization failed: {ex.Message}");
            ShowFallback(view, generation);
        }
    }

    private bool IsCurrent(WebView2CompositionControl view, int generation) =>
        !_closed && _enabled && _generation == generation && ReferenceEquals(_view, view);

    private void ShowFallback(WebView2CompositionControl view, int generation)
    {
        if (!IsCurrent(view, generation)) return;
        _generation++;
        _view = null;
        _initializationTask = null;
        _ready = false;
        _recoveryInFlight = false;
        Content = CreateFallbackButton();
        view.Dispose();
    }

    private System.Windows.Controls.Button CreateFallbackButton()
    {
        var button = new System.Windows.Controls.Button { Content = FallbackLabel(_locale), Padding = new Thickness(12, 8, 12, 8) };
        button.Click += (_, _) => _openDashboard();
        return button;
    }

    private bool AllowedSource(string source) => Uri.TryCreate(source, UriKind.Absolute, out var uri)
        && Uri.TryCreate(_server.BaseUrl, UriKind.Absolute, out var server)
        && uri.Scheme == server.Scheme && uri.Authority == server.Authority && uri.AbsolutePath == _descriptor.PagePath;

    // ── Web-message protocol ─────────────────────────────────────────────

    private void ReceiveMessage(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        if (!AllowedSource(e.Source) || _closed || !_enabled
            || _view?.CoreWebView2 is not { } core || !ReferenceEquals(sender, core)) return;
        string message;
        try { message = e.TryGetWebMessageAsString(); }
        catch (ArgumentException) { return; }
        var prefix = _descriptor.MessagePrefix;
        // if/else instead of switch: the prefixed cases are not compile-time constants.
        if (message == prefix + ":ready")
        {
            _ready = true;
            ResizeWidget(false);
            _lastContext = null;
            PushContext();
        }
        else if (message == prefix + ":expand")
        {
            ResizeWidget(true);
        }
        else if (message == prefix + ":collapse")
        {
            ResizeWidget(false);
        }
        else if (message == prefix + ":close")
        {
            SetEnabled(false);
        }
        else if (message == prefix + ":dashboard")
        {
            _openDashboard();
        }
        else if (message == prefix + ":drag")
        {
            ReleaseCapture();
            SendMessage(_hwnd, 0xA1, (nint)2, 0);
            Place(false);
            if (GetWindowRect(_hwnd, out var rect))
            {
                _savedX = rect.Left;
                _savedY = rect.Top;
                PersistPosition(_savedX, _savedY);
            }
        }
        else
        {
            HandleJsonMessage(message, prefix);
        }
    }

    /// <summary>Parse a JSON control message (<c>&lt;prefix&gt;:select</c>) — ignored by widgets without selection support.</summary>
    private void HandleJsonMessage(string message, string prefix)
    {
        if (_descriptor.MaxSelected <= 0 || message.Length > 1024) return;
        try
        {
            using var doc = JsonDocument.Parse(message);
            var root = doc.RootElement;
            if (root.TryGetProperty("type", out var typeElement)
                && typeElement.GetString() == prefix + ":select"
                && root.TryGetProperty("ids", out var idsElement)
                && idsElement.ValueKind == JsonValueKind.Array)
            {
                var ids = idsElement.EnumerateArray().Select(value => value.GetString()).ToArray();
                if (ids.Length > _descriptor.MaxSelected
                    || ids.Any(id => string.IsNullOrEmpty(id) || id.Length > 100)) return;
                var unique = ids.Select(id => id!).Distinct().ToArray();
                PersistSelected(unique);
                _lastContext = null;
                PushContext();
            }
        }
        catch (Exception ex) when (ex is JsonException or InvalidOperationException or KeyNotFoundException) { }
    }

    private void OnProcessFailed(
        CoreWebView2 core,
        WebView2CompositionControl view,
        int generation,
        CoreWebView2ProcessFailedKind kind)
    {
        if (!IsCurrent(view, generation) || !ReferenceEquals(_view?.CoreWebView2, core)) return;
        if (kind is not (CoreWebView2ProcessFailedKind.RenderProcessExited
            or CoreWebView2ProcessFailedKind.RenderProcessUnresponsive
            or CoreWebView2ProcessFailedKind.BrowserProcessExited)) return;
        Diag.Log(_descriptor.Kind, $"webview process failed kind={kind}");
        _ready = false;
        _lastContext = null;
        if (_recoveryInFlight) return;
        if (_recoveryAttempts >= MaxRecoveryAttempts)
        {
            ShowFallback(view, generation);
            return;
        }

        _recoveryAttempts++;
        _recoveryInFlight = true;
        try { Dispatcher.BeginInvoke(new Action(() => _ = RecoverAsync(core, view, generation, _recoveryAttempts, kind))); }
        catch { _recoveryInFlight = false; ShowFallback(view, generation); }
    }

    private async Task RecoverAsync(
        CoreWebView2 core,
        WebView2CompositionControl view,
        int generation,
        int attempt,
        CoreWebView2ProcessFailedKind kind)
    {
        try
        {
            var recovered = kind != CoreWebView2ProcessFailedKind.BrowserProcessExited
                && await TryReloadAsync(core);
            if (!IsCurrent(view, generation)) return;
            if (!recovered) await RecreateViewAsync(view, generation);
        }
        catch (Exception ex)
        {
            if (IsCurrent(view, generation))
            {
                Diag.Log(_descriptor.Kind, $"recovery attempt {attempt} failed: {ex.Message}");
                ShowFallback(view, generation);
            }
        }
        finally
        {
            if (IsCurrent(view, generation)) _recoveryInFlight = false;
        }
    }

    private static async Task<bool> TryReloadAsync(CoreWebView2 core)
    {
        var completed = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        EventHandler<CoreWebView2NavigationCompletedEventArgs> handler = (_, e) => completed.TrySetResult(e.IsSuccess);
        core.NavigationCompleted += handler;
        try { core.Reload(); }
        catch
        {
            core.NavigationCompleted -= handler;
            return false;
        }

        var finished = await Task.WhenAny(completed.Task, Task.Delay(TimeSpan.FromSeconds(5)));
        core.NavigationCompleted -= handler;
        return finished == completed.Task && await completed.Task;
    }

    private async Task RecreateViewAsync(WebView2CompositionControl oldView, int oldGeneration)
    {
        if (!IsCurrent(oldView, oldGeneration)) return;
        ReleaseView();
        if (!_enabled || _closed) return;
        var view = EnsureView();
        var generation = _generation;
        _initializationTask = InitializeAsync(view, generation);
        await _initializationTask;
        if (IsCurrent(view, generation)) _recoveryInFlight = false;
    }

    private void ReleaseView()
    {
        _generation++;
        _initializationTask = null;
        _recoveryInFlight = false;
        _ready = false;
        _lastContext = null;
        var old = _view;
        _view = null;
        Content = null;
        old?.Dispose();
    }

    // ── Sizing, placement, context push ──────────────────────────────────

    private void ResizeWidget(bool expanded)
    {
        _expanded = expanded;
        Width = expanded ? _descriptor.ExpandedWidth : _descriptor.CollapsedWidth;
        Height = expanded ? _descriptor.ExpandedHeight : _descriptor.CollapsedHeight;
        Place(false);
    }

    private void ServerChanged(ServerManager.ServerStatus status)
    {
        if (_closed || !_enabled) return;
        Dispatcher.BeginInvoke(new Action(() =>
        {
            if (_closed || !_enabled) return;
            if (status == ServerManager.ServerStatus.Running) Navigate();
            else MarkFailed();
        }));
    }

    private void Navigate()
    {
        if (!_closed && _enabled && _view?.CoreWebView2 is { } core
            && _server.Status == ServerManager.ServerStatus.Running)
            core.Navigate(_server.BaseUrl + _descriptor.PagePath + "?app=1");
    }

    private void PushContext()
    {
        if (!_ready || _closed || !_enabled || !IsVisible || _view?.CoreWebView2 is not { } core) return;
        var context = new JsonObject
        {
            ["type"] = _descriptor.MessagePrefix + ":context",
            ["locale"] = _locale,
            ["light"] = _light,
            ["style"] = _style,
            ["failed"] = _failed,
        };
        AddContextProperties(context);
        if (_descriptor.MaxSelected > 0)
        {
            var selected = new JsonArray();
            foreach (var id in LoadSelected()) selected.Add(id);
            context["selected"] = selected;
        }
        string json;
        try { json = context.ToJsonString(); }
        catch (Exception ex) when (ex is InvalidOperationException or ArgumentNullException) { return; }
        if (json == _lastContext) return;
        try { core.PostWebMessageAsJson(json); _lastContext = json; }
        catch (InvalidOperationException) { _ready = false; }
    }

    // ── Fullscreen-app auto-hide ─────────────────────────────────────────

    private void StartFullscreenMonitoring()
    {
        if (_hwnd == 0) return;
        if (_foregroundHook == 0)
            _foregroundHook = SetWinEventHook(
                EventSystemForeground, EventSystemForeground, 0, _winEventCallback, 0, 0,
                WineventOutOfContext);
        if (_locationChangeHook == 0)
            _locationChangeHook = SetWinEventHook(
                EventObjectLocationChange, EventObjectLocationChange, 0, _winEventCallback, 0, 0,
                WineventOutOfContext);
        if (_foregroundHook == 0 || _locationChangeHook == 0)
            Diag.Log(_descriptor.Kind, "fullscreen event hook could not be installed");
    }

    private void StopFullscreenMonitoring()
    {
        if (_foregroundHook != 0) UnhookWinEvent(_foregroundHook);
        if (_locationChangeHook != 0) UnhookWinEvent(_locationChangeHook);
        _foregroundHook = 0;
        _locationChangeHook = 0;
    }

    private void OnWinEvent(nint hook, uint eventType, nint hwnd, int idObject, int idChild, uint eventThread, uint eventTime)
    {
        if (eventType == EventObjectLocationChange
            && (idObject != 0 || idChild != 0 || hwnd != GetForegroundWindow())) return;
        QueueFullscreenCheck();
    }

    private void QueueFullscreenCheck()
    {
        if (Interlocked.Exchange(ref _fullscreenCheckQueued, 1) != 0) return;
        try
        {
            Dispatcher.BeginInvoke(new Action(() =>
            {
                Interlocked.Exchange(ref _fullscreenCheckQueued, 0);
                CheckFullscreenState();
            }));
        }
        catch { Interlocked.Exchange(ref _fullscreenCheckQueued, 0); }
    }

    private void CheckFullscreenState()
    {
        if (_closed || !_enabled) return;
        if (ForegroundIsFullscreen())
        {
            if (IsVisible)
            {
                _fullscreenHidden = true;
                Hide();
            }
        }
        else if (_fullscreenHidden)
        {
            _fullscreenHidden = false;
            if (!IsVisible) Show();
            Place(false);
        }
    }

    private void OnVisibilityChanged()
    {
        if (IsVisible && !_closed && _enabled)
        {
            Place(!_placed);
            _placed = true;
            _lastContext = null;
            PushContext();
        }
    }

    private void Place(bool restore)
    {
        if (_hwnd == 0) return;
        var scale = GetDpiForWindow(_hwnd) / 96d;
        var width = (int)Math.Round(Width * scale);
        var height = (int)Math.Round(Height * scale);
        GetWindowRect(_hwnd, out var rect);
        var x = restore ? _savedX : rect.Left;
        var y = restore ? _savedY : rect.Top;
        var screen = x.HasValue && y.HasValue ? Screen.FromPoint(new System.Drawing.Point(x.Value, y.Value)) : Screen.PrimaryScreen!;
        var work = screen.WorkingArea;
        var left = Math.Clamp(x ?? work.Right - width - 16, work.Left, Math.Max(work.Left, work.Right - width));
        // Never-placed widgets stack on the same spot otherwise; stagger the
        // default Y by kind until the user drags one (positions then persist).
        var defaultTop = work.Top + work.Height / 3 + _descriptor.DefaultSlot * 180;
        var top = Math.Clamp(y ?? defaultTop, work.Top, Math.Max(work.Top, work.Bottom - height));
        if (rect.Left != left || rect.Top != top || rect.Right - rect.Left != width || rect.Bottom - rect.Top != height)
            SetWindowPos(_hwnd, 0, left, top, width, height, 0x14); // NOZORDER | NOACTIVATE
        var radius = (int)((_expanded ? 20 : 18) * scale * 2);
        if (_regionSize != (width, height, radius))
        {
            var region = CreateRoundRectRgn(0, 0, width + 1, height + 1, radius, radius);
            if (SetWindowRgn(_hwnd, region, true) == 0) DeleteObject(region);
            else _regionSize = (width, height, radius);
        }
    }

    private nint WindowMessage(nint hwnd, int message, nint wParam, nint lParam, ref bool handled)
    {
        if (message is 0x02E0 or 0x007E) Dispatcher.BeginInvoke(new Action(() => { if (!_closed) Place(false); }));
        return 0;
    }

    private bool ForegroundIsFullscreen()
    {
        var foreground = GetForegroundWindow();
        if (foreground == 0 || foreground == _hwnd || !GetWindowRect(foreground, out var rect)) return false;
        var className = new System.Text.StringBuilder(256);
        GetClassName(foreground, className, className.Capacity);
        if (className.ToString() is "Progman" or "WorkerW") return false;
        var screen = Screen.FromHandle(_hwnd);
        var bounds = screen.Bounds;
        return rect.Left <= bounds.Left && rect.Top <= bounds.Top && rect.Right >= bounds.Right && rect.Bottom >= bounds.Bottom;
    }

    private delegate void WinEventDelegate(nint hook, uint eventType, nint hwnd, int idObject, int idChild, uint eventThread, uint eventTime);

    [StructLayout(LayoutKind.Sequential)] private struct RECT { public int Left, Top, Right, Bottom; }
    [DllImport("user32.dll")] private static extern bool GetWindowRect(nint hwnd, out RECT rect);
    [DllImport("user32.dll")] private static extern uint GetDpiForWindow(nint hwnd);
    [DllImport("user32.dll")] private static extern bool SetWindowPos(nint hwnd, nint after, int x, int y, int width, int height, uint flags);
    [DllImport("user32.dll")] private static extern nint GetForegroundWindow();
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetClassName(nint hwnd, System.Text.StringBuilder value, int size);
    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] private static extern nint GetWindowLongPtr(nint hwnd, int index);
    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW")] private static extern nint SetWindowLongPtr(nint hwnd, int index, nint value);
    [DllImport("user32.dll")] private static extern bool ReleaseCapture();
    [DllImport("user32.dll")] private static extern nint SendMessage(nint hwnd, int message, nint wParam, nint lParam);
    [DllImport("gdi32.dll")] private static extern nint CreateRoundRectRgn(int left, int top, int right, int bottom, int width, int height);
    [DllImport("user32.dll")] private static extern int SetWindowRgn(nint hwnd, nint region, bool redraw);
    [DllImport("user32.dll")] private static extern bool DeleteObject(nint obj);
    [DllImport("user32.dll")] private static extern nint SetWinEventHook(uint eventMin, uint eventMax, nint eventHookModule, WinEventDelegate eventHook, uint processId, uint threadId, uint flags);
    [DllImport("user32.dll")] private static extern bool UnhookWinEvent(nint eventHook);
}
