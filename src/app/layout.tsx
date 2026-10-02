import type { Metadata, Viewport } from "next";
import { Fira_Code, Fira_Sans } from "next/font/google";

import { Providers } from "@/components/providers";

import "./globals.css";

const firaSans = Fira_Sans({
  variable: "--font-fira-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

// Used for every number that updates in place: the timer, KPI counters,
// duration columns. Tabular figures keep digits from reflowing as they tick.
const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "OttoLabs",
    template: "%s · OttoLabs",
  },
  description: "Track what you are learning, and find out when you actually focus.",
  applicationName: "OttoLabs",
  appleWebApp: { capable: true, title: "OttoLabs", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Edge to edge, so the installed app can sit under a black-translucent iOS
  // status bar. Everything pinned to an edge pads itself with
  // env(safe-area-inset-*) to stay clear of the notch and home indicator.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfefd" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1416" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${firaSans.variable} ${firaCode.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
