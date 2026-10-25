# Creates a double-click launch shortcut for TokenTracker on the current user's desktop.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File create-desktop-shortcut.ps1 [-Name TokenTracker]
param(
    [string]$Name = "TokenTracker"
)

$ErrorActionPreference = "Stop"

$exe = Join-Path $PSScriptRoot "..\bin\Release\net8.0-windows10.0.19041.0\TokenTracker.exe"
$exe = [System.IO.Path]::GetFullPath($exe)
if (-not (Test-Path $exe)) {
    throw "TokenTracker.exe not found at $exe — build it first: dotnet build TokenTrackerWin/TokenTrackerWin.csproj -c Release"
}

$desktop = [Environment]::GetFolderPath("Desktop")
$lnkPath = Join-Path $desktop "$Name.lnk"

$ws = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut($lnkPath)
$lnk.TargetPath = $exe
$lnk.WorkingDirectory = Split-Path $exe
$lnk.Description = "Token Tracker (local dashboard + tray + pet)"
$lnk.Save()

Write-Host "Shortcut created: $lnkPath -> $exe"
