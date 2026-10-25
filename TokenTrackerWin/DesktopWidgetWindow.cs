using System.Text.Json;
using System.Text.Json.Nodes;

namespace TokenTrackerWin;

/// <summary>Descriptors for the four generic desktop widgets.</summary>
internal static class DesktopWidgets
{
    public static readonly DesktopWidgetDescriptor Summary = new(
        Kind: "summary",
        PagePath: "/widget-summary.html",
        MessagePrefix: "summary",
        CollapsedWidth: 320, CollapsedHeight: 144,
        ExpandedWidth: 360, ExpandedHeight: 260,
        DefaultSlot: 1);

    public static readonly DesktopWidgetDescriptor Heatmap = new(
        Kind: "heatmap",
        PagePath: "/widget-heatmap.html",
        MessagePrefix: "heatmap",
        CollapsedWidth: 360, CollapsedHeight: 190,
        ExpandedWidth: 460, ExpandedHeight: 330,
        DefaultSlot: 2);

    public static readonly DesktopWidgetDescriptor TopModels = new(
        Kind: "topmodels",
        PagePath: "/widget-topmodels.html",
        MessagePrefix: "topmodels",
        CollapsedWidth: 320, CollapsedHeight: 170,
        ExpandedWidth: 360, ExpandedHeight: 300,
        DefaultSlot: 3);

    public static readonly DesktopWidgetDescriptor Limits = new(
        Kind: "limits",
        PagePath: "/widget-limits.html",
        MessagePrefix: "limits",
        CollapsedWidth: 320, CollapsedHeight: 170,
        ExpandedWidth: 360, ExpandedHeight: 340,
        MaxSelected: 4,
        DefaultSlot: 4);

    public static readonly DesktopWidgetDescriptor[] All =
        [Summary, Heatmap, TopModels, Limits];
}

/// <summary>
/// A generic desktop widget window (summary / heatmap / top models / limits).
/// The host pushes a JSON payload via <see cref="UpdateData"/>, which lands in
/// the page's context under <c>data</c>; everything else is inherited from
/// <see cref="DesktopWidgetWindowBase"/>. State is persisted per kind in a
/// shared <see cref="DesktopWidgetSettings"/> file.
/// </summary>
internal sealed class DesktopWidgetWindow : DesktopWidgetWindowBase
{
    private readonly DesktopWidgetSettings _settings;
    private string? _dataJson;

    public DesktopWidgetWindow(
        DesktopWidgetDescriptor descriptor,
        ServerManager server,
        Action openDashboard,
        WidgetWebViewEnvironment webViewEnvironment,
        DesktopWidgetSettings settings)
        : base(descriptor, server, openDashboard, webViewEnvironment)
    {
        _settings = settings;
    }

    /// <summary>Push a fresh JSON payload (usage stats, heatmap grid, limits…) into the page.</summary>
    public void UpdateData(string json)
    {
        _dataJson = json;
        DataApplied();
    }

    protected override bool LoadEnabled() => DesktopWidgetSettings.Load().For(Kind).Enabled;

    protected override void PersistEnabled(bool enabled)
    {
        _settings.For(Kind).Enabled = enabled;
        _settings.Save();
    }

    protected override (int? X, int? Y)? LoadPosition()
    {
        var state = DesktopWidgetSettings.Load().For(Kind);
        return (state.X, state.Y);
    }

    protected override void PersistPosition(int? x, int? y)
    {
        var state = _settings.For(Kind);
        state.X = x;
        state.Y = y;
        _settings.Save();
    }

    protected override string[] LoadSelected() => _settings.For(Kind).Selected;

    protected override void PersistSelected(string[] ids)
    {
        _settings.For(Kind).Selected = ids;
        _settings.Save();
    }

    protected override string FallbackLabel(string locale) => Kind switch
    {
        "summary" => TrayStrings.For(locale).WidgetSummary,
        "heatmap" => TrayStrings.For(locale).WidgetHeatmap,
        "topmodels" => TrayStrings.For(locale).WidgetTopModels,
        "limits" => TrayStrings.For(locale).WidgetLimits,
        _ => Constants.AppDisplayName,
    };

    protected override void AddContextProperties(JsonObject context)
    {
        // Parse fresh each push: a cached JsonNode cannot be re-parented into
        // a new context object, and a few KB per minute is negligible.
        if (_dataJson is null) return;
        try { context["data"] = JsonNode.Parse(_dataJson); }
        catch (JsonException) { /* keep the previous context */ }
    }
}
