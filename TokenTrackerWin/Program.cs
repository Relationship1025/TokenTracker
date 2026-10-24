namespace TokenTrackerWin;

internal static class Program
{
    // Stable per-user mutex name so a second launch just exits.
    private const string SingleInstanceMutexName = "TokenTracker.Windows.Tray.SingleInstance";

    [STAThread]
    private static void Main(string[] args)
    {
        InstallExceptionGuards();

        var launchedAtStartup = args.Any(a =>
            string.Equals(a, LaunchAtStartup.StartupArgument, StringComparison.OrdinalIgnoreCase));
        Diag.Log("program", $"Main argc={args.Length} startup={launchedAtStartup}");

        using var mutex = new Mutex(initiallyOwned: true, SingleInstanceMutexName, out var isNew);
        Diag.Log("program", $"mutex isNew={isNew}");
        if (!isNew)
        {
            // Already running: a second copy must exit (single-instance app).
            return;
        }

        // Set per-monitor DPI awareness before WPF can create any HWNDs.
        ApplicationConfiguration.Initialize();

        // A WPF Application instance gives the (WPF) dashboard window its resource /
        // dispatcher context. We never call its Run(); the WinForms message pump below
        // drives the shared STA thread (and the WPF Dispatcher rides on it). Explicit
        // shutdown mode so WPF doesn't tear itself down when the window is hidden.
        var wpfApp = new System.Windows.Application { ShutdownMode = System.Windows.ShutdownMode.OnExplicitShutdown };
        TrayApplicationContext? trayContext = null;
        wpfApp.DispatcherUnhandledException += (_, e) =>
        {
            var shuttingDown = wpfApp.Dispatcher.HasShutdownStarted || wpfApp.Dispatcher.HasShutdownFinished;
            var recovery = DispatcherExceptionPolicy.Classify(e.Exception, shuttingDown);
            if (recovery == DispatcherExceptionPolicy.RecoveryKind.IgnoreAfterShutdown
                || recovery == DispatcherExceptionPolicy.RecoveryKind.IgnoreCancellation)
            {
                Diag.Log("program", $"WPF dispatcher exception absorbed during window teardown: {e.Exception}");
                // These callbacks have no useful work left after cancellation or
                // dispatcher teardown, so allowing WPF to continue is intentional.
                e.Handled = true;
                return;
            }

            if (recovery == DispatcherExceptionPolicy.RecoveryKind.RecreateDashboardWebView
                && trayContext?.RecoverDashboardWebView(e.Exception) == true)
            {
                Diag.Log("program", $"WPF dispatcher exception recovered by recreating WebView2: {e.Exception}");
                e.Handled = true;
                return;
            }

            // Do not turn an unknown dispatcher failure into a silently-running
            // but corrupted tray process. Leaving Handled=false preserves WPF's
            // normal shutdown path after the diagnostic has been recorded.
            Diag.Log("program", $"WPF dispatcher exception unhandled: {e.Exception}");
        };

        // Show the desktop pet on a normal launch (manual run or post-install), but stay
        // quietly in the tray when Windows auto-starts us at login. The dashboard no
        // longer auto-opens — the pet is the visible presence.
        var showPetOnLaunch = !launchedAtStartup;
        var ctx = new TrayApplicationContext(showPetOnLaunch);
        trayContext = ctx;

        Application.Run(ctx);

        GC.KeepAlive(mutex);
    }

    private static void InstallExceptionGuards()
    {
        AppDomain.CurrentDomain.UnhandledException += (_, e) =>
            Diag.Log("program", $"unhandled exception terminating={e.IsTerminating}: {e.ExceptionObject}");
        TaskScheduler.UnobservedTaskException += (_, e) =>
        {
            Diag.Log("program", $"unobserved task exception: {e.Exception}");
            e.SetObserved();
        };
        System.Windows.Forms.Application.SetUnhandledExceptionMode(
            System.Windows.Forms.UnhandledExceptionMode.CatchException);
        System.Windows.Forms.Application.ThreadException += (_, e) =>
            Diag.Log("program", $"WinForms UI exception: {e}");
    }

}
