import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });

import * as Sentry from "@sentry/nextjs";

export function generateMetadata(): Metadata {
  return {
    title: "Insight | Pak Youth For Gaza",
    description: "Automated intelligence for Pak Youth For Gaza",
    icons: {
      icon: '/icon-pwa.png',
    },
    manifest: '/manifest.json',
    other: {
      ...Sentry.getTraceData()
    }
  };
}

export const viewport = {
  themeColor: 'black',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

import { DeveloperProvider } from "@/components/DeveloperTools";
import { NotificationProvider } from "@/context/NotificationContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans antialiased overflow-x-hidden bg-black bg-grid-white/[0.05]`}>
        <DeveloperProvider>
          <NotificationProvider>
            {children}
          </NotificationProvider>
        </DeveloperProvider>
      </body>
    </html>
  );
}
