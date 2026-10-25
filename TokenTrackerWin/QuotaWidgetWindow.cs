using System.Text.Json;
using System.Text.Json.Nodes;

namespace TokenTrackerWin;

/// <summary>
/// The desktop quota widget — the original specialized surface. All generic
/// window machinery lives in <see cref="DesktopWidgetWindowBase"/>; this class
/// only contributes the quota specifics: provider-limit data, its persisted
/// selection of up to two provider windows, and the quota settings file.
/// </summary>
internal sealed class QuotaWidgetWindow : DesktopWidgetWindowBase
{
    public static readonly DesktopWidgetDescriptor Descriptor = new(
        Kind: "quota",
        PagePath: "/quota.html",
        MessagePrefix: "quota",
        CollapsedWidth: 320, CollapsedHeight: 144,
        ExpandedWidth: 360, ExpandedHeight: 340,
        MaxSelected: 2);

    // Lazy: the base ctor invokes the Load* overrides before this class's
    // constructor body runs, so they cannot rely on an assigned field.
    private QuotaWidgetSettings? _settings;
    private QuotaWidgetSettings Settings => _settings ??= QuotaWidgetSettings.Load();
    private JsonNode? _limits;

    public QuotaWidgetWindow(
        ServerManager server,
        Action openDashboard,
        WidgetWebViewEnvironment webViewEnvironment)
        : base(Descriptor, server, openDashboard, webViewEnvironment)
    {
    }

    public void ApplyLimits(string json)
    {
        try { _limits = JsonNode.Parse(json); }
        catch (JsonException) { MarkFailed(); return; }
        DataApplied();
    }

    protected override bool LoadEnabled() => QuotaWidgetSettings.Load().Enabled;

    protected override void PersistEnabled(bool enabled)
    {
        Settings.Enabled = enabled;
        Settings.Save();
    }

    protected override (int? X, int? Y)? LoadPosition()
    {
        var s = QuotaWidgetSettings.Load();
        return (s.X, s.Y);
    }

    protected override void PersistPosition(int? x, int? y)
    {
        Settings.X = x;
        Settings.Y = y;
        Settings.Save();
    }

    protected override string[] LoadSelected() => Settings.Selected;

    protected override void PersistSelected(string[] ids)
    {
        Settings.Selected = ids;
        Settings.Save();
    }

    protected override string FallbackLabel(string locale) => TrayStrings.For(locale).DesktopQuota;

    protected override void AddContextProperties(JsonObject context)
    {
        context["limits"] = _limits?.DeepClone();
    }
}
