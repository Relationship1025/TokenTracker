import React from "react";
import { DataTransferSection } from "../components/settings/DataTransferSection.jsx";
import { copy } from "../lib/copy";

export function DataTransferPage() {
  return (
    <div className="flex flex-1 flex-col font-oai text-oai-black antialiased dark:text-oai-white">
      <main className="flex-1 pb-12 pt-8 sm:pb-16 sm:pt-10">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
          <div className="mb-7 max-w-2xl">
            <h1 className="text-3xl font-semibold tracking-tight text-oai-black dark:text-white sm:text-4xl">
              {copy("settings.section.transfer")}
            </h1>
            <p className="mt-2 text-sm leading-6 text-oai-gray-500 dark:text-oai-gray-400 sm:text-base">
              {copy("settings.section.transfer.description")}
            </p>
          </div>
          <DataTransferSection />
        </div>
      </main>
    </div>
  );
}
