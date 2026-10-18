import React from "react";
import { LogOut } from "lucide-react";
import { copy } from "../../lib/copy";
import { SectionCard, SettingsRow } from "./Controls.jsx";
import { Button } from "../../ui/components/Button.jsx";
import { SignedOutAccountSection } from "./AccountSectionParts.jsx";

export function AccountSection({ settings } = {}) {
  if (!settings?.enabled) return null;
  if (!settings.signedIn) return <SignedOutAccountSection />;
  return (
    <SectionCard
      title={copy("settings.section.account")}
      subtitle={settings.email || settings.userId}
      action={<Button variant="ghost" size="sm" onClick={() => settings.signOut?.()}><LogOut className="mr-1.5 h-3.5 w-3.5" aria-hidden />{copy("settings.account.signOut")}</Button>}
    >
      {settings.userId ? <SettingsRow label={copy("settings.account.userId")} hint={<span className="font-mono">{settings.userId}</span>} /> : null}
    </SectionCard>
  );
}
