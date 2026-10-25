using System.IO;
using System.Text.Json;

namespace TokenTrackerWin;

/// <summary>
/// Persisted state for the four generic desktop widgets (summary, heatmap,
/// top models, limits) in one JSON file. A single shared instance is owned by
/// <see cref="TrayApplicationContext"/> and mutated by the widget windows —
/// every save rewrites the whole file atomically.
/// </summary>
internal sealed class DesktopWidgetSettings
{
    private static readonly string FilePath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TokenTracker", "desktop-widgets.json");

    public sealed class WidgetState
    {
        public bool Enabled { get; set; }
        public int? X { get; set; }
        public int? Y { get; set; }
        public string[] Selected { get; set; } = [];
    }

    public Dictionary<string, WidgetState> Widgets { get; set; } = [];

    public static DesktopWidgetSettings Load()
    {
        try
        {
            var settings = JsonSerializer.Deserialize<DesktopWidgetSettings>(File.ReadAllText(FilePath)) ?? new();
            settings.Widgets = settings.Widgets ?? new Dictionary<string, WidgetState>();
            foreach (var (kind, state) in settings.Widgets)
            {
                state.Selected = (state.Selected ?? [])
                    .Where(id => !string.IsNullOrWhiteSpace(id) && id.Length <= 100)
                    .Distinct().ToArray();
            }
            return settings;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException) { return new(); }
    }

    /// <summary>Get (or create) the state entry for one widget kind.</summary>
    public WidgetState For(string kind) =>
        Widgets.TryGetValue(kind, out var state) ? state : (Widgets[kind] = new WidgetState());

    public void Save()
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(FilePath)!);
            File.WriteAllText(FilePath + ".tmp", JsonSerializer.Serialize(this));
            File.Move(FilePath + ".tmp", FilePath, true);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { Diag.Log("widgets", $"settings save failed: {ex.Message}"); }
    }
}
