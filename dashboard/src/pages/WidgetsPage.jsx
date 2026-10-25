import React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Cat, Check, Gauge, Monitor, Zap } from "lucide-react";
import { copy } from "../lib/copy";
import { useNativeSettings } from "../hooks/use-native-settings.js";
import { ToggleSwitch } from "../components/settings/Controls.jsx";
import { FadeIn, StaggerContainer, StaggerItem } from "../ui/foundation/FadeIn.jsx";

/* ---------- Desktop quota widget (Windows tray app) ----------
 * Functional card: the toggle writes the `quotaWidget` native setting through
 * the WebView2 bridge; TokenTrackerWin applies it via SetQuotaWidgetEnabled
 * (the same path as the tray menu's "Desktop quota" item) and pushes the
 * canonical state back, so both toggles always agree. The screenshots are the
 * real surfaces from docs/design (320 × 144 collapsed, 360 × 340 expanded).
 */

const QUOTA_FEATURES = [
  "widgets.quota.features.bars",
  "widgets.quota.features.expand",
  "widgets.quota.features.move",
  "widgets.quota.features.theme",
];

function QuotaScreenshot({ src, captionKey, ariaKey }) {
  return (
    <figure className="flex flex-col items-center gap-2">
      <img
        src={src}
        alt={copy(ariaKey)}
        loading="lazy"
        className="w-full max-w-[360px] rounded-lg border border-oai-gray-200 shadow-oai-sm dark:border-oai-gray-800 dark:shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
      />
      <figcaption className="text-xs text-oai-gray-500 dark:text-oai-gray-400">
        {copy(captionKey)}
      </figcaption>
    </figure>
  );
}

function QuotaWidgetCard({ available, settings, setSetting }) {
  // settings is null until the native snapshot arrives — keep the switch
  // inert for that beat so it doesn't flash "off" for an enabled widget.
  const enabled = settings?.quotaWidget === true;

  return (
    <section className="rounded-xl border border-oai-gray-200 bg-white p-5 dark:border-oai-gray-800 dark:bg-oai-gray-900 sm:p-6">
      <div className="flex items-center gap-2">
        <Gauge className="h-4 w-4 text-oai-gray-500 dark:text-oai-gray-400" strokeWidth={1.75} aria-hidden />
        <h2 className="text-sm font-semibold">{copy("widgets.quota.title")}</h2>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-oai-gray-500 dark:text-oai-gray-400">
        {copy("widgets.quota.description")}
      </p>

      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="text-sm font-medium">{copy("widgets.quota.toggle.label")}</div>
        <ToggleSwitch
          checked={enabled}
          onChange={() => setSetting("quotaWidget", !enabled)}
          disabled={!available || settings === null}
          ariaLabel={copy("widgets.quota.toggle.label")}
        />
      </div>

      <ul className="mt-4 space-y-2">
        {QUOTA_FEATURES.map((key) => (
          <li key={key} className="flex items-start gap-2 text-sm text-oai-gray-600 dark:text-oai-gray-300">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-oai-brand-500" strokeWidth={2} aria-hidden />
            {copy(key)}
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-wrap items-start gap-6">
        <QuotaScreenshot
          src="/widgets/quota-collapsed.png"
          captionKey="widgets.quota.screenshot.collapsed.caption"
          ariaKey="widgets.quota.screenshot.collapsed.aria"
        />
        <QuotaScreenshot
          src="/widgets/quota-expanded.png"
          captionKey="widgets.quota.screenshot.expanded.caption"
          ariaKey="widgets.quota.screenshot.expanded.aria"
        />
      </div>

      {!available ? (
        <div className="mt-5 flex gap-2 rounded-xl bg-oai-gray-100 p-3 text-xs leading-relaxed text-oai-gray-500 dark:bg-oai-gray-800/70 dark:text-oai-gray-400">
          <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {copy("widgets.quota.browser_hint")}
        </div>
      ) : null}
    </section>
  );
}

/* ---------- System tray (info card, replaces the macOS menu-bar section) ---------- */

const TRAY_ITEMS = [
  "widgets.tray.item.dashboard",
  "widgets.tray.item.quota",
  "widgets.tray.item.pet",
  "widgets.tray.item.startup",
  "widgets.tray.item.quit",
];

function TrayInfoCard() {
  return (
    <section className="flex h-full flex-col rounded-xl border border-oai-gray-200 bg-white p-5 dark:border-oai-gray-800 dark:bg-oai-gray-900 sm:p-6">
      <div className="flex items-center gap-2">
        <Monitor className="h-4 w-4 text-oai-gray-500 dark:text-oai-gray-400" strokeWidth={1.75} aria-hidden />
        <h2 className="text-sm font-semibold">{copy("widgets.tray.title")}</h2>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-oai-gray-500 dark:text-oai-gray-400">
        {copy("widgets.tray.description")}
      </p>
      <ul className="mt-4 space-y-2">
        {TRAY_ITEMS.map((key) => (
          <li key={key} className="flex items-start gap-2 text-sm text-oai-gray-600 dark:text-oai-gray-300">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-oai-brand-500" strokeWidth={2} aria-hidden />
            {copy(key)}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- More desktop widgets (summary / heatmap / top models / limits) ---------- */

const WIDGET_CARDS = [
  {
    kind: "summary",
    settingKey: "widgetSummary",
    nameKey: "widgets.card.summary.name",
    descKey: "widgets.card.summary.description",
    toggleKey: "widgets.card.summary.toggle",
    Preview: SummaryPreview,
  },
  {
    kind: "heatmap",
    settingKey: "widgetHeatmap",
    nameKey: "widgets.card.heatmap.name",
    descKey: "widgets.card.heatmap.description",
    toggleKey: "widgets.card.heatmap.toggle",
    Preview: HeatmapPreview,
  },
  {
    kind: "topmodels",
    settingKey: "widgetTopmodels",
    nameKey: "widgets.card.topmodels.name",
    descKey: "widgets.card.topmodels.description",
    toggleKey: "widgets.card.topmodels.toggle",
    Preview: TopModelsPreview,
  },
  {
    kind: "limits",
    settingKey: "widgetLimits",
    nameKey: "widgets.card.limits.name",
    descKey: "widgets.card.limits.description",
    toggleKey: "widgets.card.limits.toggle",
    Preview: LimitsPreview,
  },
];

/* Compact static previews that echo each widget surface's real layout. */

function PreviewShell({ children }) {
  return (
    <div className="flex h-20 items-center justify-center rounded-lg bg-oai-gray-100 p-3 dark:bg-oai-gray-950/60">
      {children}
    </div>
  );
}

function SummaryPreview() {
  return (
    <PreviewShell>
      <div className="grid w-full grid-cols-2 gap-4 text-[10px]">
        <div>
          <div className="font-bold uppercase tracking-wide text-oai-gray-500 dark:text-oai-gray-400">today</div>
          <div className="text-base font-medium tabular-nums">203.2M <span className="text-[10px] text-oai-gray-500">$129.56</span></div>
        </div>
        <div>
          <div className="font-bold uppercase tracking-wide text-oai-gray-500 dark:text-oai-gray-400">7 days</div>
          <div className="text-base font-medium tabular-nums">880.9M</div>
        </div>
      </div>
    </PreviewShell>
  );
}

function HeatmapPreview() {
  const cells = [];
  for (let i = 0; i < 7 * 24; i += 1) {
    const level = Math.floor(Math.abs(Math.sin(i * 2.7)) * 5);
    cells.push(
      <span key={i} className={`rounded-[2px] h-1.5 w-1.5 ${["bg-oai-gray-200 dark:bg-oai-gray-800", "bg-emerald-800", "bg-emerald-600", "bg-emerald-400", "bg-emerald-300"][level]}`} />,
    );
  }
  return (
    <PreviewShell>
      <div className="grid grid-flow-col grid-rows-7 gap-[2px]" aria-hidden="true">
        {cells}
      </div>
    </PreviewShell>
  );
}

function TopModelsPreview() {
  const rows = [
    { name: "claude-opus-4-6", pct: 59, w: "59%", color: "bg-[#C77DFF]" },
    { name: "claude-sonnet-4-5", pct: 22, w: "22%", color: "bg-[#C77DFF]" },
    { name: "gpt-5.4", pct: 8, w: "8%", color: "bg-[#0A84FF]" },
  ];
  return (
    <PreviewShell>
      <div className="w-full space-y-1.5" aria-hidden="true">
        {rows.map(row => (
          <div key={row.name} className="flex items-center gap-2 text-[10px]">
            <span className={`h-1.5 w-1.5 rounded-full ${row.color}`} />
            <span className="min-w-0 flex-1 truncate text-oai-gray-600 dark:text-oai-gray-300">{row.name}</span>
            <span className="tabular-nums text-oai-gray-500">{row.pct}%</span>
            <span className="h-1 w-16 overflow-hidden rounded bg-oai-gray-200 dark:bg-oai-gray-800">
              <span className={`block h-full rounded ${row.color} opacity-70`} style={{ width: row.w }} />
            </span>
          </div>
        ))}
      </div>
    </PreviewShell>
  );
}

function LimitsPreview() {
  return (
    <PreviewShell>
      <div className="w-full space-y-3" aria-hidden="true">
        {[
          { name: "Claude", w: "61%" },
          { name: "Codex", w: "32%" },
        ].map(row => (
          <div key={row.name}>
            <div className="flex justify-between text-[10px] text-oai-gray-600 dark:text-oai-gray-300">
              <span>{row.name}</span>
              <span className="tabular-nums">reset in 2d</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded bg-oai-gray-200 dark:bg-oai-gray-800">
              <span className="block h-full rounded bg-gradient-to-r from-emerald-500 to-emerald-300" style={{ width: row.w }} />
            </div>
          </div>
        ))}
      </div>
    </PreviewShell>
  );
}

function WidgetGalleryCard({ card, available, settings, setSetting }) {
  const enabled = settings?.[card.settingKey] === true;
  const { Preview } = card;
  return (
    <section className="flex h-full flex-col rounded-xl border border-oai-gray-200 bg-white p-5 dark:border-oai-gray-800 dark:bg-oai-gray-900 sm:p-6">
      <Preview />
      <h3 className="mt-4 text-[15px] font-semibold text-oai-black dark:text-white">
        {copy(card.nameKey)}
      </h3>
      <p className="mt-1.5 flex-1 text-sm leading-relaxed text-oai-gray-500 dark:text-oai-gray-400">
        {copy(card.descKey)}
      </p>
      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="text-sm font-medium">{copy(card.toggleKey)}</div>
        <ToggleSwitch
          checked={enabled}
          onChange={() => setSetting(card.settingKey, !enabled)}
          disabled={!available || settings === null}
          ariaLabel={copy(card.toggleKey)}
        />
      </div>
    </section>
  );
}

function WidgetGallery({ available, settings, setSetting }) {
  return (
    <section className="mt-8">
      <h2 className="mb-4 text-xl font-semibold tracking-tight text-oai-black dark:text-white sm:mb-5 sm:text-2xl">
        {copy("widgets.gallery.title")}
      </h2>
      <StaggerContainer className="grid gap-4 sm:grid-cols-2">
        {WIDGET_CARDS.map(card => (
          <StaggerItem key={card.kind}>
            <WidgetGalleryCard card={card} available={available} settings={settings} setSetting={setSetting} />
          </StaggerItem>
        ))}
      </StaggerContainer>
      {!available ? (
        <div className="mt-4 flex gap-2 rounded-xl bg-oai-gray-100 p-3 text-xs leading-relaxed text-oai-gray-500 dark:bg-oai-gray-800/70 dark:text-oai-gray-400">
          <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {copy("widgets.gallery.hint")}
        </div>
      ) : null}
    </section>
  );
}

/* ---------- Floating pet entry (full settings live on /pet-settings) ---------- */

function PetEntryCard() {
  return (
    <Link
      to="/pet-settings"
      className="group flex h-full flex-col rounded-xl border border-oai-gray-200 bg-white p-5 no-underline transition-colors hover:border-oai-gray-300 dark:border-oai-gray-800 dark:bg-oai-gray-900 dark:hover:border-oai-gray-700 sm:p-6"
    >
      <div className="flex items-center gap-2">
        <Cat className="h-4 w-4 text-oai-gray-500 dark:text-oai-gray-400" strokeWidth={1.75} aria-hidden />
        <h2 className="text-sm font-semibold text-oai-black dark:text-white">{copy("widgets.pet.title")}</h2>
      </div>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-oai-gray-500 dark:text-oai-gray-400">
        {copy("widgets.pet.description")}
      </p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-oai-brand-500">
        {copy("widgets.pet.link")}
        <ArrowUpRight
          className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          aria-hidden
        />
      </span>
    </Link>
  );
}

/* ---------- Page ---------- */

export function WidgetsPage() {
  const { available, settings, setSetting } = useNativeSettings();
  return (
    <div className="flex flex-col flex-1 text-oai-black dark:text-oai-white font-oai antialiased">
      <main className="flex-1 pt-8 sm:pt-10 pb-12 sm:pb-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <FadeIn y={12}>
            <header className="mb-10 sm:mb-12">
              <h1 className="text-3xl font-semibold tracking-tight text-oai-black dark:text-white sm:text-4xl">
                {copy("widgets.page.title")}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-oai-gray-500 dark:text-oai-gray-400 sm:text-base">
                {copy("widgets.page.subtitle")}
              </p>
            </header>
          </FadeIn>

          <FadeIn y={12} delay={0.05}>
            <QuotaWidgetCard available={available} settings={settings} setSetting={setSetting} />
          </FadeIn>

          <FadeIn y={12} delay={0.1}>
            <WidgetGallery available={available} settings={settings} setSetting={setSetting} />
          </FadeIn>

          <StaggerContainer className="mt-6 grid gap-4 sm:grid-cols-2">
            <StaggerItem>
              <TrayInfoCard />
            </StaggerItem>
            <StaggerItem>
              <PetEntryCard />
            </StaggerItem>
          </StaggerContainer>
        </div>
      </main>
    </div>
  );
}
