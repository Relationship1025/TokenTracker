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
        Assert.False(NativeTheme.ResolveIsLight("neon-store"));
    }

    [Fact]
    public void UnknownPreferencesStillFallBackToDark()
    {
        Assert.Equal("dark", NativeTheme.NormalizePreference("mystery"));
    }
}
