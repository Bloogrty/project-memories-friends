"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { ClientConfig } from "@/config";
import { getTexts, type Texts } from "./texts";

/**
 * The browser's copy of the settings. The root layout reads them on the server
 * (getClientConfig) and passes them in here, so client code never reads env.
 */
const ClientConfigContext = createContext<ClientConfig | null>(null);

export function ClientConfigProvider({ value, children }: { value: ClientConfig; children: ReactNode }) {
  return <ClientConfigContext value={value}>{children}</ClientConfigContext>;
}

export function useClientConfig(): ClientConfig {
  const config = useContext(ClientConfigContext);
  if (!config) throw new Error("useClientConfig must be used inside ClientConfigProvider (src/app/layout.tsx).");
  return config;
}

/** All guest-facing text, in UI_LANGUAGE. */
export function useTexts(): Texts {
  const { language, textOverrides } = useClientConfig();
  return useMemo(() => getTexts(language, textOverrides), [language, textOverrides]);
}
