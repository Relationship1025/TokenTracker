import React from "react";
import { copy } from "../../lib/copy";
import { SectionCard, SettingsRow } from "./Controls.jsx";

export function AccountSection({ settings } = {}) {
  if (!settings?.enabled || !settings.signedIn) return null;
  return (
    <SectionCard
      title={copy("settings.section.account")}
      subtitle={settings.email || settings.userId}
    >
      {settings.userId ? <SettingsRow label={copy("settings.account.userId")} hint={<span className="font-mono">{settings.userId}</span>} /> : null}
    </SectionCard>
  );
}
