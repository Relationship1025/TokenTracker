import React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { useNativeSettings } from "../../hooks/use-native-settings.js";
import { copy } from "../../lib/copy";
import { cn } from "../../lib/cn";
import { isNativeWindowsApp } from "../../lib/native-bridge.js";
import { SectionCard, SettingsRow, ToggleSwitch } from "./Controls.jsx";
import { Button } from "../../ui/components/Button.jsx";

export function MenuBarSection() {
  const { available, settings, setSetting, runAction } = useNativeSettings();
  if (!available) return null;
  const isWindows = isNativeWindowsApp();

  // showStats + animatedIcon live on the Widgets page (Menu Bar section) where
  // they sit next to the live preview. This section keeps only the system-level
  // toggles + actions that don't have a visual analogue.
  const launchAtLogin = Boolean(settings?.launchAtLogin);
  const toastOnReset = settings?.toastOnReset !== false;
  const confettiOnReset = settings?.confettiOnReset !== false;
  const launchAtLoginSupported = settings?.launchAtLoginSupported !== false;
  const isSyncing = Boolean(settings?.isSyncing);

  return (
    <SectionCard title={copy("settings.section.menubar")}>
      {!isWindows ? (
        <>
          <SettingsRow
            label={copy("settings.menubar.appearance")}
            hint={copy("settings.menubar.appearanceHint")}
            control={
              <Button
                as={Link}
                to="/widgets"
                variant="secondary"
                size="sm"
                className="gap-1.5 no-underline"
              >
                <span>{copy("settings.menubar.appearanceLink")}</span>
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </Button>
            }
          />
          <SettingsRow
            label={copy("settings.menubar.toastOnReset")}
            hint={copy("settings.menubar.toastOnResetHint")}
            control={
              <ToggleSwitch
                checked={toastOnReset}
                onChange={() => setSetting("toastOnReset", !toastOnReset)}
                ariaLabel={copy("settings.menubar.toastOnReset")}
              />
            }
          />
          <SettingsRow
            label={copy("settings.menubar.confettiOnReset")}
            hint={copy("settings.menubar.confettiOnResetHint")}
            control={
              <ToggleSwitch
                checked={confettiOnReset}
                onChange={() => setSetting("confettiOnReset", !confettiOnReset)}
                ariaLabel={copy("settings.menubar.confettiOnReset")}
              />
            }
          />
        </>
      ) : null}
      {launchAtLoginSupported ? (
        <SettingsRow
          label={copy("settings.menubar.launchAtLogin")}
          hint={copy("settings.menubar.launchAtLoginHint")}
          control={
            <ToggleSwitch
              checked={launchAtLogin}
              onChange={() => setSetting("launchAtLogin", !launchAtLogin)}
              ariaLabel={copy("settings.menubar.launchAtLogin")}
            />
          }
        />
      ) : null}
      <SettingsRow
        label={copy("settings.menubar.syncNow")}
        hint={copy("settings.menubar.syncNowHint")}
        control={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => runAction("syncNow")}
            disabled={isSyncing}
            className="gap-1.5"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} aria-hidden />
            <span>{isSyncing ? copy("settings.menubar.syncing") : copy("settings.menubar.syncNow")}</span>
          </Button>
        }
      />
    </SectionCard>
  );
}

export function NativeAppFooter() {
  const { available, settings, runAction } = useNativeSettings();
  const showNativeInfo = available && settings?.version;
  const nativePlatform = settings?.platform || "macos";
  const currentVersion = import.meta.env.VITE_APP_VERSION || "0.0.0";

  return (
    <div className="mt-6 flex flex-col items-center justify-center gap-4 text-xs text-oai-gray-500 dark:text-oai-gray-500">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {showNativeInfo ? (
          <>
            <span>
              {nativePlatform === "windows"
                ? copy("settings.menubar.updates.footerCore", { version: settings.version })
                : copy("settings.menubar.updates.footerCombined", {
                    barVersion: settings.version,
                    coreVersion: currentVersion,
                  })}
            </span>
            <span aria-hidden>·</span>
            <button
              type="button"
              onClick={() => runAction("openAbout")}
              className="underline-offset-2 transition-colors hover:text-oai-gray-700 hover:underline dark:hover:text-oai-gray-300"
            >
              GitHub
            </button>
          </>
        ) : (
          <span>{copy("settings.menubar.updates.footerCore", { version: currentVersion })}</span>
        )}
      </div>
    </div>
  );
}
