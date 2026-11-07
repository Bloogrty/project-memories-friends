import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import { publicConfig } from "@/config";
import "./globals.css";

const sans = DM_Sans({ variable: "--font-body", subsets: ["latin"] });
const display = Fraunces({ variable: "--font-heading", subsets: ["latin"] });

export const metadata: Metadata = {
  title: publicConfig.appName,
  description: "A shared photo album for the day.",
  // The links are the only access control, so keep them out of search engines.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf6ef" },
    { media: "(prefers-color-scheme: dark)", color: "#191613" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
