using System.IO;
using System.Text.Json.Nodes;
using Microsoft.Win32;

namespace TokenTrackerWin;

internal static class NativeTheme
{
    public const string PreferenceKey = "tokentracker-theme";
    public const string StorePeriodKey = "tokentracker-neon-store-period";
    public const string SystemPreference = "system";
    public const string LightPreference = "light";
    public const string DarkPreference = "dark";
    public const string NeonStorePreference = "neon-store";
    public const string DayPeriod = "day";
    public const string NightPeriod = "night";

    private static readonly string SettingsPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "TokenTracker",
        "native-settings.json");

    public static string CurrentPreference => ReadStoredPreference() ?? DarkPreference;

    public static string CurrentNeonStorePeriod => ReadStoredPeriod() ?? NightPeriod;

    public static string NormalizePreference(string? value)
    {
        var raw = (value ?? "").Trim().ToLowerInvariant();
        return raw switch
        {
            LightPreference => LightPreference,
            DarkPreference => DarkPreference,
            NeonStorePreference => NeonStorePreference,
            SystemPreference => SystemPreference,
            _ => DarkPreference,
        };
    }

    public static string NormalizeNeonStorePeriod(string? value)
    {
        return (value ?? "").Trim().ToLowerInvariant() == DayPeriod ? DayPeriod : NightPeriod;
    }

    public static bool ResolveIsLight(string? preference) =>
        ResolveIsLight(preference, CurrentNeonStorePeriod);

    public static bool ResolveIsLight(string? preference, string? neonStorePeriod)
    {
        return NormalizePreference(preference) switch
        {
            LightPreference => true,
            DarkPreference => false,
            NeonStorePreference => NormalizeNeonStorePeriod(neonStorePeriod) == DayPeriod,
            _ => IsWindowsAppLightTheme(),
        };
    }

    /// <summary>
    /// The desktop-widget surface style: classic dark/light, or the neon-store
    /// theme's day/night variants. Pushed to every widget window as a string
    /// the pages map onto CSS classes.
    /// </summary>
    public static string ResolveWidgetStyle(string? preference, string? neonStorePeriod = null)
    {
        return NormalizePreference(preference) switch
        {
            LightPreference => "classic-light",
            NeonStorePreference => NormalizeNeonStorePeriod(neonStorePeriod) == DayPeriod
                ? "store-day"
                : "store-night",
            DarkPreference => "classic-dark",
            _ => IsWindowsAppLightTheme() ? "classic-light" : "classic-dark",
        };
    }

    public static bool IsLightWidgetStyle(string style) =>
        style is "classic-light" or "store-day";

    public static void StorePreference(string? value)
    {
        var normalized = NormalizePreference(value);
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(SettingsPath)!);
            var settings = ReadSettingsObject();
            settings["Theme"] = normalized;
            File.WriteAllText(SettingsPath, settings.ToJsonString());
        }
        catch { /* best-effort native preference cache */ }
    }

    public static void StoreNeonStorePeriod(string? value)
    {
        var normalized = NormalizeNeonStorePeriod(value);
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(SettingsPath)!);
            var settings = ReadSettingsObject();
            settings["NeonStorePeriod"] = normalized;
            File.WriteAllText(SettingsPath, settings.ToJsonString());
        }
        catch { /* best-effort native preference cache */ }
    }

    private static string? ReadStoredPreference()
    {
        try
        {
            if (!File.Exists(SettingsPath)) return null;
            var settings = JsonNode.Parse(File.ReadAllText(SettingsPath))?.AsObject();
            return settings?["Theme"]?.GetValue<string>() is { Length: > 0 } theme
                ? NormalizePreference(theme)
                : null;
        }
        catch
        {
            return null;
        }
    }

    private static string? ReadStoredPeriod()
    {
        try
        {
            if (!File.Exists(SettingsPath)) return null;
            var settings = JsonNode.Parse(File.ReadAllText(SettingsPath))?.AsObject();
            return settings?["NeonStorePeriod"]?.GetValue<string>() is { Length: > 0 } period
                ? NormalizeNeonStorePeriod(period)
                : null;
        }
        catch
        {
            return null;
        }
    }

    private static JsonObject ReadSettingsObject()
    {
        try
        {
            if (!File.Exists(SettingsPath)) return new JsonObject();
            return JsonNode.Parse(File.ReadAllText(SettingsPath))?.AsObject() ?? new JsonObject();
        }
        catch
        {
            return new JsonObject();
        }
    }

    private static bool IsWindowsAppLightTheme()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(
                @"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize");
            return (key?.GetValue("AppsUseLightTheme") as int?) == 1;
        }
        catch
        {
            return false;
        }
    }
}
