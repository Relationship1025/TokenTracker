import React from "react";
import { Info, Languages, Moon, Palette, Store, Sun } from "lucide-react";
import { themeControlValue, themeFromControlValue } from "../../ui/foundation/theme-preference.js";
import { useTheme } from "../../hooks/useTheme.js";
import { useLocale } from "../../hooks/useLocale.js";
import { useCurrency } from "../../hooks/useCurrency.js";
import { useTokenFormat } from "../../hooks/useTokenFormat.js";
import { DE_LOCALE, EN_LOCALE, JA_LOCALE, KO_LOCALE, SYSTEM_LOCALE, ZH_CN_LOCALE, ZH_TW_LOCALE } from "../../lib/locale";
import { CURRENCY_USD, getSupportedCurrencies } from "../../lib/currency";
import { copy } from "../../lib/copy";
import { Select } from "../../ui/components";
import { SectionCard, SegmentedControl, SettingsRow } from "./Controls.jsx";
import { TOKEN_FORMAT_MODES, TOKEN_GROUPINGS, TOKEN_UNIT_SYSTEMS } from "../../lib/token-format.js";

function buildThemeOptions() {
  return [
    { value: "classic", label: copy("settings.appearance.theme.classic"), Icon: Palette },
    { value: "neon-store", label: copy("settings.appearance.theme.neon_store"), Icon: Store },
  ];
}

function buildLanguageOptions() {
  return [
    { value: SYSTEM_LOCALE, label: copy("settings.appearance.language.system") },
    { value: EN_LOCALE, label: copy("settings.appearance.language.english") },
    { value: ZH_CN_LOCALE, label: copy("settings.appearance.language.chinese") },
    { value: ZH_TW_LOCALE, label: copy("settings.appearance.language.traditional_chinese") },
    { value: JA_LOCALE, label: copy("settings.appearance.language.japanese") },
    { value: KO_LOCALE, label: copy("settings.appearance.language.korean") },
    { value: DE_LOCALE, label: copy("settings.appearance.language.german") },
  ];
}

function formatUpdatedAt(ts) {
  if (!ts) return null;
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString();
  } catch {
    return null;
  }
}

function buildSourceTooltip(rateSource, rateFetchedAt) {
  const source = copy(`settings.appearance.currency.rate_source.${rateSource}`);
  const updatedAt = formatUpdatedAt(rateFetchedAt);
  const when = updatedAt
    ? copy("settings.appearance.currency.rate_updated", { when: updatedAt })
    : copy("settings.appearance.currency.rate_never");
  return `${source} · ${when}`;
}

function LanguageDropdown({ locale, setLocale }) {
  const options = buildLanguageOptions();
  return (
    <Select
      value={locale}
      onValueChange={setLocale}
      options={options}
      ariaLabel={copy("settings.appearance.language.label")}
      className="px-2.5 py-1.5 text-xs font-medium"
      leadingIcon={
        <Languages
          className="h-3.5 w-3.5 text-oai-gray-500 dark:text-oai-gray-400"
          aria-hidden
        />
      }
    />
  );
}

function CurrencyDropdown({ currency, setCurrency }) {
  const options = getSupportedCurrencies().map((opt) => ({
    value: opt.code,
    label: copy(opt.labelKey),
  }));
  return (
    <Select
      value={currency}
      onValueChange={setCurrency}
      options={options}
      ariaLabel={copy("settings.appearance.currency.label")}
      className="px-3 py-1.5 text-xs font-medium"
    />
  );
}

function CurrencyHint({ currency, rate, rateSource, rateFetchedAt }) {
  if (currency === CURRENCY_USD) {
    return <>{copy("settings.appearance.currency.hint")}</>;
  }
  const tooltip = buildSourceTooltip(rateSource, rateFetchedAt);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{`1 USD = ${rate.toFixed(4)} ${currency}`}</span>
      <span
        role="img"
        aria-label={tooltip}
        title={tooltip}
        className="inline-flex h-4 w-4 cursor-help items-center justify-center text-oai-gray-400 hover:text-oai-gray-600 dark:text-oai-gray-500 dark:hover:text-oai-gray-300"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </span>
    </span>
  );
}

function buildStorePeriodOptions() {
  return [
    { value: "day", label: copy("dashboard.rainy_store.period_day"), Icon: Sun },
    { value: "night", label: copy("dashboard.rainy_store.period_night"), Icon: Moon },
  ];
}

export function AppearanceSection() {
  const { theme, setTheme, resolvedTheme, neonStorePeriod = "night", setNeonStorePeriod } = useTheme();
  const showStorePeriod = themeControlValue(theme) === "neon-store";
  const { locale, setLocale } = useLocale();
  const { currency, rate, rateSource, rateFetchedAt, setCurrency } = useCurrency();
  const {
    mode: tokenFormatMode,
    setMode: setTokenFormatMode,
    unitSystem: tokenUnitSystem,
    setUnitSystem: setTokenUnitSystem,
    grouping: tokenGrouping,
    setGrouping: setTokenGrouping,
  } = useTokenFormat();

  return (
    <SectionCard title={copy("settings.section.appearance")}>
      <SettingsRow
        label={copy("settings.appearance.theme.label")}
        hint={copy("settings.appearance.theme.hint")}
        control={
          <SegmentedControl
            options={buildThemeOptions()}
            value={themeControlValue(theme)}
            onChange={(value) => setTheme(themeFromControlValue(value, resolvedTheme, theme))}
          />
        }
      />
      {showStorePeriod ? (
        <SettingsRow
          label={copy("dashboard.rainy_store.period_label")}
          hint={copy("settings.appearance.store_period.hint")}
          control={
            <SegmentedControl
              options={buildStorePeriodOptions()}
              value={neonStorePeriod === "day" ? "day" : "night"}
              onChange={(value) => setNeonStorePeriod?.(value)}
            />
          }
        />
      ) : null}
      <SettingsRow
        label={copy("settings.appearance.language.label")}
        hint={copy("settings.appearance.language.hint")}
        control={<LanguageDropdown locale={locale} setLocale={setLocale} />}
      />
      <SettingsRow
        label={copy("settings.appearance.currency.label")}
        hint={
          <CurrencyHint
            currency={currency}
            rate={rate}
            rateSource={rateSource}
            rateFetchedAt={rateFetchedAt}
          />
        }
        control={<CurrencyDropdown currency={currency} setCurrency={setCurrency} />}
      />
      <SettingsRow
        label={copy("settings.appearance.token_format.label")}
        hint={copy("settings.appearance.token_format.hint")}
        control={
          <SegmentedControl
            options={[
              {
                value: TOKEN_FORMAT_MODES.COMPACT,
                label: copy("settings.appearance.token_format.compact"),
              },
              {
                value: TOKEN_FORMAT_MODES.FULL,
                label: copy("settings.appearance.token_format.full"),
              },
            ]}
            value={tokenFormatMode}
            onChange={setTokenFormatMode}
          />
        }
      />
      <SettingsRow
        label={copy("settings.appearance.token_unit.label")}
        hint={copy("settings.appearance.token_unit.hint")}
        control={
          <SegmentedControl
            disabled={tokenFormatMode !== TOKEN_FORMAT_MODES.COMPACT}
            options={[
              {
                value: TOKEN_UNIT_SYSTEMS.ENGLISH,
                label: copy("settings.appearance.token_unit.english"),
              },
              {
                value: TOKEN_UNIT_SYSTEMS.CHINESE,
                label: copy("settings.appearance.token_unit.chinese"),
              },
            ]}
            value={tokenUnitSystem}
            onChange={setTokenUnitSystem}
          />
        }
      />
      <SettingsRow
        label={copy("settings.appearance.token_grouping.label")}
        hint={copy("settings.appearance.token_grouping.hint")}
        control={
          <SegmentedControl
            options={[
              {
                value: TOKEN_GROUPINGS.THOUSAND,
                label: copy("settings.appearance.token_grouping.thousand"),
              },
              {
                value: TOKEN_GROUPINGS.WAN,
                label: copy("settings.appearance.token_grouping.wan"),
              },
            ]}
            value={tokenGrouping}
            onChange={setTokenGrouping}
          />
        }
      />
    </SectionCard>
  );
}
