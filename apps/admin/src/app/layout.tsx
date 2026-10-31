import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Admin terminal", template: "%s · Demo admin" },
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await headers(); // dynamic rendering: every response gets its own CSP nonce
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
