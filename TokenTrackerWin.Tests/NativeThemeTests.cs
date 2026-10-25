using TokenTrackerWin;
using Xunit;

namespace TokenTrackerWin.Tests;

public sealed class NativeThemeTests
{
    [Fact]
    public void NeonStoreRoundTripsAndResolvesDark()
    {
        Assert.Equal("neon-store", NativeTheme.NormalizePreference("neon-store"));
        Assert.Equal("neon-store", NativeTheme.NormalizePreference(" NEON-STORE "));
        Assert.Equal("night", NativeTheme.NormalizeNeonStorePeriod("night"));
        Assert.Equal("night", NativeTheme.NormalizeNeonStorePeriod(null));
        Assert.Equal("night", NativeTheme.NormalizeNeonStorePeriod("solstice"));
        Assert.Equal("day", NativeTheme.NormalizeNeonStorePeriod(" Day "));
    }

    [Fact]
    public void UnknownPreferencesStillFallBackToDark()
    {
        Assert.Equal("dark", NativeTheme.NormalizePreference("mystery"));
    }

    [Fact]
    public void NeonStoreResolvesLightOnlyForDayPeriod()
    {
        Assert.False(NativeTheme.ResolveIsLight("neon-store", "night"));
        Assert.True(NativeTheme.ResolveIsLight("neon-store", "day"));
        Assert.True(NativeTheme.ResolveIsLight("light", "night"));
        Assert.False(NativeTheme.ResolveIsLight("dark", "day"));
    }

    [Fact]
    public void WidgetStylesMapThemeAndPeriod()
    {
        Assert.Equal("store-night", NativeTheme.ResolveWidgetStyle("neon-store", "night"));
        Assert.Equal("store-day", NativeTheme.ResolveWidgetStyle(" neon-store ", "DAY"));
        Assert.Equal("store-night", NativeTheme.ResolveWidgetStyle("neon-store"));
        Assert.Equal("classic-light", NativeTheme.ResolveWidgetStyle("light"));
        Assert.Equal("classic-dark", NativeTheme.ResolveWidgetStyle("dark"));
        Assert.Equal("classic-dark", NativeTheme.ResolveWidgetStyle("bogus"));
        Assert.True(NativeTheme.IsLightWidgetStyle("store-day"));
        Assert.True(NativeTheme.IsLightWidgetStyle("classic-light"));
        Assert.False(NativeTheme.IsLightWidgetStyle("store-night"));
        Assert.False(NativeTheme.IsLightWidgetStyle("classic-dark"));
    }
}
