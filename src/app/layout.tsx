import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import { getClientConfig, getServerTexts } from "@/config";
import { ClientConfigProvider } from "@/lib/client-config";
import { themeCss } from "@/lib/theme";
import "./globals.css";

const sans = DM_Sans({ variable: "--font-body", subsets: ["latin"] });
const display = Fraunces({ variable: "--font-heading", subsets: ["latin"] });

export function generateMetadata(): Metadata {
  const config = getClientConfig();
  return {
    title: config.appTitle,
    description: config.appSubtitle ?? getServerTexts().metaDescription,
    // The links are the only access control, so keep them out of search engines.
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf6ef" },
    { media: "(prefers-color-scheme: dark)", color: "#191613" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const config = getClientConfig();
  return (
    <html lang={config.language} className={`${sans.variable} ${display.variable} h-full antialiased`}>
      {/* THEME_PRIMARY is checked to be a plain hex colour at startup, so it is safe to inline. */}
      {config.themePrimary && (
        <head>
          <style>{themeCss(config.themePrimary)}</style>
        </head>
      )}
      <body className="flex min-h-full flex-col">
        <ClientConfigProvider value={config}>{children}</ClientConfigProvider>
      </body>
    </html>
  );
}
