import React from "react";
import { Link } from "react-router-dom";
import { copy } from "../../lib/copy";
import { SectionCard } from "./Controls.jsx";

export function SignedOutAccountSection() {
  return (
    <SectionCard title={copy("settings.section.account")}>
      <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="text-sm text-oai-gray-500 dark:text-oai-gray-400">
          {copy("settings.account.signedOutHint")}
        </p>
        <Link
          to="/login"
          className="inline-flex min-h-8 items-center justify-center rounded-md bg-oai-brand-600 px-3 text-sm font-medium text-white no-underline hover:bg-oai-brand-700"
        >
          {copy("settings.account.signIn")}
        </Link>
      </div>
    </SectionCard>
  );
}
