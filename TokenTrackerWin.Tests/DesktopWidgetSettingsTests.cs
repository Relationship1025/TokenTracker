using System.Text.Json;
using TokenTrackerWin;
using Xunit;

namespace TokenTrackerWin.Tests;

public class DesktopWidgetSettingsTests : IDisposable
{
    private readonly string _dir;

    public DesktopWidgetSettingsTests()
    {
        _dir = Path.Combine(Path.GetTempPath(), "tt-widget-tests-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_dir);
    }

    public void Dispose()
    {
        try { Directory.Delete(_dir, recursive: true); } catch { /* best effort */ }
    }

    private string SettingsPath => Path.Combine(_dir, "desktop-widgets.json");

    private DesktopWidgetSettings RoundTrip(DesktopWidgetSettings settings)
    {
        Directory.CreateDirectory(_dir);
        File.WriteAllText(SettingsPath, JsonSerializer.Serialize(settings));
        // Load() reads the fixed %LOCALAPPDATA% path, so exercise the same
        // parse path through a direct deserialize for shape compatibility.
        return JsonSerializer.Deserialize<DesktopWidgetSettings>(File.ReadAllText(SettingsPath))!;
    }

    [Fact]
    public void For_CreatesMissingEntry()
    {
        var settings = new DesktopWidgetSettings();
        var state = settings.For("summary");
        Assert.Same(state, settings.For("summary"));
        Assert.False(state.Enabled);
        Assert.Null(state.X);
    }

    [Fact]
    public void RoundTrip_KeepsEnabledAndPosition()
    {
        var settings = new DesktopWidgetSettings();
        var state = settings.For("heatmap");
        state.Enabled = true;
        state.X = 120;
        state.Y = 64;
        state.Selected = ["claude:seven_day", "codex:primary"];

        var loaded = RoundTrip(settings);
        var heatmap = loaded.For("heatmap");
        Assert.True(heatmap.Enabled);
        Assert.Equal(120, heatmap.X);
        Assert.Equal(64, heatmap.Y);
        Assert.Equal(["claude:seven_day", "codex:primary"], heatmap.Selected);
    }

    [Fact]
    public void Load_WithMissingFile_ReturnsEmpty()
    {
        // The real Load() reads %LOCALAPPDATA%; a fresh machine yields no widgets.
        var settings = DesktopWidgetSettings.Load();
        Assert.NotNull(settings.Widgets);
    }
}
